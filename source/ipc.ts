import * as libcrypto from "crypto";

export default libcrypto.randomBytes(16).toString("hex");
