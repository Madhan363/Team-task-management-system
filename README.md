# Todo List App

## Run with MongoDB

1. Install/start MongoDB locally or create a MongoDB Atlas database.
2. Copy `.env.example` to `.env` if you do not already have a `.env` file.
3. Set `MONGODB_URI` to your database connection string and `JWT_SECRET` to a random secret with at least 32 characters. Never commit or share `.env`.
4. Install packages with `npm install`.
5. Start the API in one terminal with `npm run server`.
6. Start the frontend in a second terminal with `npm run dev`, then open the local URL shown by Vite.

The Vite server proxies `/api` to the Express API on port 4000. In production, build the frontend using `npm run build`, then run `npm run server` to serve it from Express.

Accounts are stored in MongoDB with bcrypt-hashed passwords. Authentication uses an HTTP-only session cookie, and each user's tasks are scoped to that account. Existing browser-local accounts and tasks are not migrated automatically.
