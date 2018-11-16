let generate = (N) => {
  let vals = [];
  for (let k = 0; k < N; k++) {
    let sum = 0;
    let f = k === 0 ? Math.sqrt(1/N) : Math.sqrt(2/N);
    for (let n = 0; n < N; n++) {
      vals.push(f*Math.cos(Math.PI*k/N*(n + 0.5)));
    }
  }
  return vals;
};

generate(8).forEach(f => {
  console.log(f.toFixed(20) + 'f,');
});
