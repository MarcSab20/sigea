const lines = require("fs").readFileSync("/app/dist/apps/auth-service/src/auth-service.module.js","utf8"); const idx = lines.indexOf("registerAsync"); console.log(lines.substring(idx-50, idx+300));
