# Elaksi Ateliers — Backend (Node + Express + Prisma + MySQL)

## Setup
```bash
cd backend
cp .env.example .env
# Edit .env: set DATABASE_URL for MySQL and a strong ADMIN_TOKEN
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

The API will run on http://localhost:4000 by default.

## Auth
Set `ADMIN_TOKEN` in `.env`. For admin/protected routes, include this header:
```
x-admin-token: YOUR_TOKEN
```

## Endpoints (summary)
- `GET /api/health`
- `GET /api/collections`
- `POST /api/collections` *(admin)*
- `PUT /api/collections/:id` *(admin)*
- `DELETE /api/collections/:id` *(admin)*
- `GET /api/products?q=&collectionId=`
- `GET /api/products/:id`
- `POST /api/products` *(admin)*
- `PUT /api/products/:id` *(admin)*
- `DELETE /api/products/:id` *(admin)*
- `POST /api/orders` *(public, minimal)*

## Notes
- Local image uploads are saved to `/uploads`. For production, swap to S3 or Cloudinary.