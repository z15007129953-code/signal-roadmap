import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  isWorkspaceLogoKey,
  logoKeyFor,
  logoUploadSchema,
} from "./logo-policy";

export function createLogoClient(config: S3ClientConfig) {
  // Presigning happens before browser bytes exist; do not sign an empty-body checksum.
  return new S3Client({
    ...config,
    // Keep uploads on the exact account origin allowed by the application CSP.
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

export function createLogoStorage(client: S3Client, bucket: string) {
  function scoped(workspace: string, key: string) {
    if (!isWorkspaceLogoKey(workspace, key))
      throw new Error("Invalid logo key");
    return { Bucket: bucket, Key: key };
  }
  return {
    async prepare(workspace: string, input: unknown) {
      const { type, size } = logoUploadSchema.parse(input);
      const key = logoKeyFor(workspace, type);
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: type,
        ContentLength: size,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: 300,
        signableHeaders: new Set(["content-type", "content-length"]),
      });
      return { key, url, headers: { "Content-Type": type } };
    },
    async verify(workspace: string, key: string) {
      const result = await client.send(
        new HeadObjectCommand(scoped(workspace, key)),
      );
      return logoUploadSchema.parse({
        type: result.ContentType,
        size: result.ContentLength,
      });
    },
    async read(workspace: string, key: string) {
      const result = await client.send(
        new GetObjectCommand(scoped(workspace, key)),
      );
      const metadata = logoUploadSchema.parse({
        type: result.ContentType,
        size: result.ContentLength,
      });
      if (!result.Body) throw new Error("Logo unavailable");
      return { ...metadata, stream: result.Body.transformToWebStream() };
    },
  };
}
