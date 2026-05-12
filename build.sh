npm install
cp /etc/secrets/.env ./server/.env
(cd shared && tsc)
(cd server && tsc)
(cd client && npm install && npm run build)
mkdir -p ./server/public
mv ./client/dist ./server/
mv ./server/dist/assets ./server/public/