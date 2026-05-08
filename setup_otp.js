const { JwtService } = require('@nestjs/jwt');
const fs = require('fs');

const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf8');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: 'dd5f13d2-4b78-46ec-9115-ffc0f28cf358', role: 'chef_escale', base_id: 'dummy', jti: 'setup' },
  { key: privateKey, passphrase: '' },
  { algorithm: 'RS256', expiresIn: '5m' }
);
console.log(token);