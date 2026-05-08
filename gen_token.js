const jwt = require('/app/node_modules/jsonwebtoken');
const key = Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf8');
const token = jwt.sign(
  { sub: 'dd5f13d2-4b78-46ec-9115-ffc0f28cf358', role: 'chef_escale', base_id: 'ba101', jti: 'setup-001' },
  { key, passphrase: '' },
  { algorithm: 'RS256', expiresIn: '10m' }
);
console.log(token);