import * as libdgram from 'dgram';

namespace libmdns {
  interface Observer {
    (host: string): void;
  }

  let rcache: Record<string, string> = {};
  let observers: Record<string, Array<Observer>> = {};

  let notify_observers = (key: string, value: string): void => {
    let obs = observers[key];
    if (obs !== undefined) {
      for (let observer of obs) {
        observer(value);
      }
    }
    let newkey = rcache[key];
    if (newkey !== undefined) {
      notify_observers(newkey, value);
    }
  };

  let add_cache_entry = (key: string, value: string, type: string): void => {
    rcache[value] = key;
    if (type === 'A') {
      notify_observers(key, value);
    }
  };

  let parse_name = (buffer: Buffer, offset: number): { value: string, offset: number } => {
    let labels = [];
    while (true) {
      let length = buffer.readUInt8(offset);
      if (length === 0) {
        offset += 1;
        break;
      }
      if (length < 64) {
        offset += 1;
        let label = buffer.slice(offset, offset + length);
        offset += length;
        labels.push(label.toString('binary'));
        continue;
      }
      if (length < 192) {
        throw new Error();
      }
      labels.push(parse_name(buffer, buffer.readUInt16BE(offset) & 0x3FFF).value);
      offset += 2;
      break;
    }
    return {
      value: labels.join('.'),
      offset: offset
    };
  };

  let parse_question = (buffer: Buffer, offset: number): { value: string, offset: number } => {
    let name = parse_name(buffer, offset);
    offset = name.offset;
    let type = buffer.readUInt16BE(offset);
    offset += 2;
    let cls = buffer.readUInt16BE(offset);
    offset += 2;
    return {
      value: name.value,
      offset: offset
    };
  };

  let parse_record = (buffer: Buffer, offset: number): { name: string, data: string, offset: number } => {
    let name = parse_name(buffer, offset);
    offset = name.offset;
    let type = buffer.readUInt16BE(offset);
    offset += 2;
    let cls = buffer.readUInt16BE(offset);
    offset += 2;
    let ttl = buffer.readUInt32BE(offset);
    offset += 4;
    let length = buffer.readUInt16BE(offset);
    offset += 2;
    let data = '';
    if (type === 1) {
      data = `${buffer[offset+0]}.${buffer[offset+1]}.${buffer[offset+2]}.${buffer[offset+3]}`;
      offset += 4;
      add_cache_entry(name.value, data, 'A');
    }
    if (type === 12) {
      let dname = parse_name(buffer, offset);
      offset = dname.offset;
      data = dname.value;
      add_cache_entry(name.value, data, 'PTR');
    }
    if (type === 16) {
      let raw = buffer.slice(offset, offset + length);
      offset += length;
      data = raw.toString('binary');
    }
    if (type === 33) {
      let priority = buffer.readUInt16BE(offset);
      offset += 2;
      let weight = buffer.readUInt16BE(offset);
      offset += 2;
      let port = buffer.readUInt16BE(offset);
      offset += 2;
      let dname = parse_name(buffer, offset);
      offset = dname.offset;
      data = dname.value;
      add_cache_entry(name.value, data, 'SRV');
    }
    return {
      name: name.value,
      data: data,
      offset: offset
    };
  };

  let parse_mdns = (buffer: Buffer): void => {
    console.log('recieved mdns packet');
    let offset = 0;
    let header = buffer.slice(offset, offset + 12);
    offset += 12;
    let id = header.readUInt16BE(0);
    let flags = header.readUInt16BE(2);
    let qdcount = header.readUInt16BE(4);
    let ancount = header.readUInt16BE(6);
    let nscount = header.readUInt16BE(8);
    let arcount = header.readUInt16BE(10);
    let questions = [];
    for (let i = 0; i < qdcount; i++) {
      let result = parse_question(buffer, offset);
      questions.push(result);
      offset = result.offset;
    }
    let answers = [];
    for (let i = 0; i < ancount; i++) {
      let result = parse_record(buffer, offset);
      answers.push(result);
      offset = result.offset;
    }
    let authorities = [];
    for (let i = 0; i < nscount; i++) {
      let result = parse_record(buffer, offset);
      authorities.push(result);
      offset = result.offset;
    }
    let additionals = [];
    for (let i = 0; i < arcount; i++) {
      let result = parse_record(buffer, offset);
      additionals.push(result);
      offset = result.offset;
    }
    console.log(JSON.stringify(rcache, null, 2));
  };

  const MDNS_ADDRESS = '224.0.0.251';
  const MDNS_PORT = 5353;

  let socket = libdgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('listening', () => {
    socket.setMulticastLoopback(false);
    socket.addMembership(MDNS_ADDRESS, '0.0.0.0');
  });

  socket.on('message', (buffer, remote_info) => {
    parse_mdns(buffer);
  });

  socket.bind(MDNS_PORT);

  export let discover = (host: string): void => {
    let header = Buffer.alloc(12);
    header.writeUInt16BE(1, 4);
    let body = Buffer.alloc(1000);
    let offset = 0;
    let labels = host.split('.').forEach(a => {
      if (a.length >= 64) {
        throw new Error();
      }
      body.writeUInt8(a.length, offset); offset += 1;
      body.write(a, offset); offset += a.length;
    });
    body.writeUInt8(0, offset); offset += 1;
    body.writeUInt16BE(12, offset); offset += 2;
    body.writeUInt16BE(1, offset); offset += 2;
    body = body.slice(0, 0 + offset);
    console.log('sending discovery packet');
    socket.send(Buffer.concat([header, body]), MDNS_PORT, MDNS_ADDRESS);
  };

  export let observe = (host: string, timeout: number, observer: Observer): { cancel(): void } => {
    let obs = observers[host];
    if (obs === undefined) {
      obs = new Array<Observer>();
      observers[host] = obs;
    }
    obs.push(observer);
    discover(host);
    let token = setInterval(() => {
      discover(host);
    }, timeout);
    return {
      cancel(): void {
        clearInterval(token);
        let index = obs.lastIndexOf(observer);
        obs.slice(index, 1);
      }
    }
  };
};

libmdns.observe('_googlecast._tcp.local', 30*1000, (host) => {
  console.log('observer notified with: ' + host);
});


/*

big endian, network

msb <-> lsb

msb is numbered as 0 in spec


header:
id:16bits
flags:16bits
  1:0=query,1=reply
  4:type,0=QUERY,1=IQUERY,2=STATUSserver status request,3-15=reserved
  1:dns_server_authoritative_for_queried_hostname (AA)
  1:message_was_truncated (TC)
  1:recursion_desired (RD)       set in query, copied to response
  1:recursion_available (RA)
  3:reserved (Z)
  4:response_code (RCODE), 0=no_error,1=format_error,2=server_failure,3=name_error,4_not_implemented,5=refused,6-15=reserved
qd_count:16bits, unsigned big endian
ancount:16bits
nscount:16bits
arcount:16bits

questions:

QNAME, sequence of labels 0x05,"joels",0x05,"local",0x00 might be uneven, max 63 bytes per label, high two bits 11 = compression
QTYPE, 16bits, PTR for chromecast
unicastresponse:1bit for mdns,chromecast send directly to server
QCLASS,16/15bits (IN=INternet)

answers,authorities,additionals:

NAME, same as QNAME
TYPE,16bits
CACHE-FLUSH,1bit,replace cached entries for this RR
CLASS,16/15bits = IN
TTL, 32bits number of seconds
RDLENGTH, 16bits rdata__length
RDATA, 4 bytes which is ip-adress





type:12(PTR)
cls:1
data:+Chromecast....



type:1(A)
cls:32769
data:4byte
*/
