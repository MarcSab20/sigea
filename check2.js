const k = Buffer.from(process.env.JWT_PRIVATE_KEY, "base64").toString("utf8"); console.log(k.substring(0,30)); console.log("len="+k.length);
