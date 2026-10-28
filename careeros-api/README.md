# CareerOS API migration target

Express + TypeScript + MongoDB API. The Spring Boot API remains the source of truth until the migration gates pass.

## Profile photo storage

Set `PROFILE_PHOTO_DIR` to a private filesystem directory with enough capacity. The default is `./data/profile-photos`. In any container deployment, mount a persistent volume at that path; the directory must not be served as static web content. MongoDB stores only generated photo keys in student profiles.

`POST /api/v1/students/me/photo` accepts one multipart file under `file`. Uploads are limited to 2 MB and checked against the allowed JPG/JPEG, PNG, or WebP extension, declared MIME type, and image signature. `GET` and `DELETE` on the same path operate only on the authenticated student's own photo.

## Local development

Copy `.env.example` to `.env`, set a strong `JWT_SECRET`, and use a MongoDB replica set as `MONGODB_URI`. Install dependencies with `npm ci`, then run `npm run dev`. The `PROFILE_PHOTO_DIR` default is covered by the repository's ignored `data/` directory.
