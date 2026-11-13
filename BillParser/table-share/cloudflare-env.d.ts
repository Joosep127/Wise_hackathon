declare namespace Cloudflare {
  interface Env {
    LOCAL_RECEIPT_OCR?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
