# Nishat Institute of Medical Science and Technology

Express and EJS website with MongoDB-backed courses, applications, announcements, administrator accounts, and public contact settings.

## Project structure

```text
bin/                 HTTP server entry point and shutdown handling
middleware/          Authentication and request middleware
models/              Mongoose schemas
public/              Static images, stylesheets, scripts, and favicon
routes/              Public and administrator routes
scripts/             One-time administration utilities
views/               EJS pages and shared partials
app.js               Express setup, security, sessions, and database startup
```

Course records and public contact settings are stored in MongoDB. Uploaded/static images live under `public/images`; use optimized WebP images for public page backgrounds and course photos where possible.

## Local development

Requirements: Node.js 20.19 or later and MongoDB.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and set local values.
3. Run `npm start` and open `http://localhost:3000`.
4. Create the first administrator with `npm run create-admin`.

Never commit `.env` or real credentials. `.env.example` contains development placeholders only.

## Production deployment

Deploy the project root with `npm ci` during the install/build stage and `npm start` as the start command. Set `NODE_ENV=production`; the host may supply `PORT`. Configure all of these as protected environment variables in the hosting provider:

| Variable | Production value |
| --- | --- |
| `MONGO_URI` | Reachable production MongoDB URI; never localhost |
| `SESSION_SECRET` | Unique random secret of at least 32 characters |
| `APP_BASE_URL` | Public HTTPS origin, such as `https://college.example.pk` with no path |
| `SMTP_HOST` | Production SMTP host |
| `SMTP_PORT` | SMTP port, usually `587` or `465` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password or provider token |
| `SMTP_FROM` | Verified sender name and address |

The application rejects incomplete production configuration, uses secure session cookies, redirects HTTP to `APP_BASE_URL`, and trusts one reverse proxy for HTTPS detection. Configure the hosting proxy to forward the original protocol and terminate TLS with a valid certificate. Run `npm run create-admin` once against the production database using a secure interactive session; do not bake administrator credentials into the deployment.

After deployment, verify the public homepage, `/contact`, `/courses`, `/robots.txt`, `/sitemap.xml`, and `/admin/login`; submit test contact and application forms; and confirm the host reports a healthy HTTPS service. The sitemap uses `APP_BASE_URL` for canonical public URLs.

## Operational notes

- MongoDB stores administrator accounts, sessions, courses, applications, announcements, and public contact settings.
- Back up MongoDB and the original image assets before release.
- Review the institution's course approvals, fee schedules, and admissions requirements before publishing them.
- Run `npm audit --omit=dev` after dependency updates.
