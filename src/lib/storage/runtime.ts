import "server-only";
import { getEnv } from "../env";
import { createLogoStorage, createLogoClient } from "./r2";
export function logoStorage() {
  const env = getEnv();
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET
  )
    return null;
  if (!/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID))
    throw Error("Invalid storage account");
  const client = createLogoClient({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return createLogoStorage(client, env.R2_BUCKET);
}
