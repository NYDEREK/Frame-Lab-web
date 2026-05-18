# Frame Lab

Deployable Frame Lab prototype.

## Local run

```bash
npm start
```

The app uses the `PORT` environment variable when provided. Railway can deploy it from the repository root.

## Persistent data

Accounts, sessions, gallery collections, license codes, downloads, and brand settings are stored in `frame-lab-db.json`.
For production, attach a persistent Railway volume and set `FRAME_LAB_DATA_DIR` to the mounted path, for example `/data`.
If the variable is not set, the app uses `RAILWAY_VOLUME_MOUNT_PATH`, `/data` when it exists, or a local `drukowane-okulary-3d/data` folder.
