# Frame Lab

Deployable Frame Lab prototype.

## Local run

```bash
npm start
```

The app uses the `PORT` environment variable when provided. Railway can deploy it from the repository root.

## Persistent data

Accounts, sessions, gallery collections, component files, license codes, downloads, and brand settings are stored in `frame-lab-db.json`.
For production, attach a persistent Railway volume and set `FRAME_LAB_DATA_DIR` to the mounted path, for example `/data`.
If the variable is not set, the app uses `RAILWAY_VOLUME_MOUNT_PATH`, `/data` when it exists, or a local `drukowane-okulary-3d/data` folder.

On Railway, repo deploys are ephemeral unless a Volume is attached. Without a Volume, registered users, activation codes, saved colors, uploaded 3MF/STEP components, and collection edits can disappear after every GitHub deploy.

Railway setup:

1. Open the Frame-Lab-web service.
2. Go to `Settings` -> `Volumes`.
3. Add a Volume and mount it at `/data`.
4. Add this service variable:

```bash
FRAME_LAB_DATA_DIR=/data
```

5. Redeploy the service.

The Developer panel shows a storage status so this is visible in the UI after login.
