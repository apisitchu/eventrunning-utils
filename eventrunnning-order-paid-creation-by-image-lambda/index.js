const { GetObjectCommand, S3Client, S3, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Readable } = require('stream')
const { RekognitionClient, ListCollectionsCommand, CreateCollectionCommand, IndexFacesCommand } = require('@aws-sdk/client-rekognition');
const { fromCognitoIdentityPool } = require('@aws-sdk/credential-providers');

const region = 'ap-southeast-1';
const s3Client = new S3Client({});
const bucketName = 'sportaction-cloud';
// Configure the Rekognition client
const rekognitionClient = new RekognitionClient({ region: region, credentials: fromCognitoIdentityPool({ identityPoolId: 'ap-southeast-1:305f64a7-8ac3-4850-a02d-8df1d85c94d1' }) });
const sharp = require("sharp");



exports.handler = async function (event, context, callback) {

    const queueMsg = JSON.parse(event.Records[0].body);
    console.log("queueMsg: " + JSON.stringify(queueMsg));
    const order_id = queueMsg.order_id;
    const image_path = queueMsg.image_path;
    const images = queueMsg.images;
    const event_watermark_hori = queueMsg.event_watermark_hori;
    const event_watermark_vertical = queueMsg.event_watermark_vertical;

    const imageList = JSON.parse(JSON.stringify(images) + "");

    try {
        const image_byte_watermark_hori = await getObject_(event_watermark_hori);
        const image_byte_watermark_vertical = await getObject_(event_watermark_vertical);

        let countImageLogo = 0;
        for (let image_name of imageList) {
            countImageLogo++;
            console.log("[" + order_id + "]" + countImageLogo + "[" + image_name + "] with logo start");
            const upload_file_name = image_path + image_name;
            const paid_logo_file_name = image_path + "logo_" + image_name;
            //check if exist file
            if (await isExitObject_(paid_logo_file_name) !== true) {

                const image_byte_s3 = await getObject_(upload_file_name);

                const image_byte = await sharp(image_byte_s3).rotate().toBuffer()

                const image_metadata = await sharp(image_byte).metadata();
                if (image_metadata.width > image_metadata.height) {

                    let image_buffer = await sharp(image_byte)
                        .withMetadata()
                        .resize({
                            width: 4003,
                            height: 2670
                        })
                        .composite([
                            {
                                input: image_byte_watermark_hori
                            },
                        ])
                        //.webp({ quality: 50 })
                        .toBuffer();
                    await pushObject_(image_buffer, paid_logo_file_name);

                } else {
                    let image_buffer = await sharp(image_byte)
                        .withMetadata()
                        .resize({
                            width: 2670,
                            height: 4003
                        })
                        .composite([
                            {
                                input: image_byte_watermark_vertical
                            },
                        ])
                        //.webp({ quality: 50 })
                        .toBuffer();
                    await pushObject_(image_buffer, paid_logo_file_name);

                }
                console.log("[" + order_id + "]" + countImageLogo + "[" + image_name + "] with logo end.");
            } else {
                console.log("[" + order_id + "]" + countImageLogo + "[" + image_name + "] with logo end [SKIP]");
            }
        }

    } catch (e) {
        console.log("[" + order_id + "]create logo image exception: " + JSON.stringify(e))
    }
};

async function isExitObject_(keyName) {
    const params = {
        Bucket: bucketName,
        Key: keyName
    }
    const s3 = new S3();
    //console.log("isExitObject_ params: " + JSON.stringify(params))
    return new Promise((resolve, reject) => {
        s3.headObject(params, err => {
            if (err) {
                resolve(false)
            } else {
                resolve(true)
            }
            resolve(response)
        })
    })
}

async function getObject_(keyName) {

    const params = {
        Bucket: bucketName,
        Key: keyName
    }
    // console.log("getObject_ params: " + JSON.stringify(params))
    const s3 = new S3();
    const s3ResponseStream = (await s3.getObject(params)).Body
    const chunks = []

    for await (const chunk of s3ResponseStream) {
        chunks.push(chunk)
    }

    return Buffer.concat(chunks);
}

async function pushObject_(buffer, filename) {

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        Body: buffer,
        ACL: 'public-read'
    });
    //console.log('pushObject_: ' + filename)
    try {
        await s3Client.send(command);
    } catch (err) {
        console.error("pushObject_ Exception: " + err);
    }
}