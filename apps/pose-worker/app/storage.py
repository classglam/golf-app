import os
import tempfile

import boto3

_s3 = boto3.client(
    "s3",
    endpoint_url=os.environ["S3_ENDPOINT"],
    region_name=os.environ["S3_REGION"],
    aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
)

_bucket = os.environ["S3_BUCKET"]


def download_video(storage_key: str) -> str:
    suffix = os.path.splitext(storage_key)[1] or ".mp4"
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    _s3.download_file(_bucket, storage_key, path)
    return path
