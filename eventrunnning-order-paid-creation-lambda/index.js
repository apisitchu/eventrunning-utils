const Jimp = require('jimp');
const axios = require('axios')
const { GetObjectCommand, S3Client, S3, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Readable } = require('stream')
const { RekognitionClient, ListCollectionsCommand, CreateCollectionCommand, IndexFacesCommand } = require('@aws-sdk/client-rekognition');
const { fromCognitoIdentityPool } = require('@aws-sdk/credential-providers');

const region = 'ap-southeast-1';
const s3Client = new S3Client({});
const bucketName = 'eventrunning-cloud';
// Configure the Rekognition client
const rekognitionClient = new RekognitionClient({ region: region, credentials: fromCognitoIdentityPool({ identityPoolId: 'ap-southeast-1:305f64a7-8ac3-4850-a02d-8df1d85c94d1' }) });
var mysql = require('mysql');
const sharp = require("sharp");

// const connection_db = {
//     host: 'thsv49.hostatom.com',
//     user: 'julius_phototh',
//     password: 'Livt407!1',
//     database: 'phototh',
// };

const connection_db = {
    host: '49.229.76.150',
    port: '8800',
    user: 'admindb',
    password: 'itit@0909',
    database: 'eventrunningdb',
};


exports.handler = async function (event, context, callback) {

    const queueMsg = JSON.parse(event.Records[0].body);
    console.log("queueMsg: " + JSON.stringify(queueMsg));
    const order_id = queueMsg.order_id;
    const event_id = queueMsg.event_id;
    const image_path = queueMsg.image_path;
    const images = queueMsg.images;
    const image_dist = queueMsg.image_dist;
    const event_watermark_hori = queueMsg.event_watermark_hori;
    const event_watermark_vertical = queueMsg.event_watermark_vertical;
    const confirm_key = queueMsg.confirm_key;
    const is_logo = queueMsg.is_logo; //Y,N

     

     //send sms/email befor process logo image
     console.log("[" + order_id + "]is_send_email : start")
     const is_send_email = await send_email(order_id, confirm_key)
     console.log("[" + order_id + "]is_send_email : " + JSON.stringify(is_send_email))
     const is_send_sms = await send_sms(order_id, confirm_key)
     console.log("[" + order_id + "]is_send_sms : " + JSON.stringify(is_send_sms))
    
    console.log("[" + order_id + "]is_logo: " + is_logo)
    if (is_logo === "Y") {
        const imageList = JSON.parse(JSON.stringify(images) + "");
        let check_logo_process = await check_update_order_is_logo_image_done(order_id);
        console.log("[" + order_id + "]check_logo_process: " + check_logo_process);
        if (!check_logo_process) {

            try {
                console.log("[" + order_id + "]process image with logo...")
                const image_byte_watermark_hori = await getObject_(event_watermark_hori);
                const image_byte_watermark_vertical = await getObject_(event_watermark_vertical);

                let countImageLogo = 0;
                for (let image_name of imageList) {
                    countImageLogo++;
                    console.log("[" + order_id + "]" + countImageLogo + "[" + image_name + "] with logo start");
                    const upload_file_name = image_path + image_name;
                    //const paid_logo_file_name = image_dist + confirm_key + "_logo_" + image_name;
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

                const promise_logo_image = await update_order_is_logo_image_done(order_id)
                console.log("[" + order_id + "]logo_image: " + JSON.stringify(promise_logo_image))

                //sms/email

            } catch (e) {
                console.log("[" + order_id + "]create logo image exception: " + JSON.stringify(e))
            }

      }else{
        console.log("[" + order_id + "]process logo image all [SKIP]");
      }
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

async function update_order_is_original_image_done(order_id) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connection_db);
        let update_sql = "update `order` set is_original_image_created = 'Y', is_original_image_create_date = now() where id = " + order_id;
        console.log("[" + order_id + "]update_sql:" + update_sql)
        connection.query(update_sql, (err, result) => {
            if (!err) {
                connection.destroy();
                resolve(true);
            } else {
                console.log("[" + order_id + "]update_order_is_original_image_done: Err" + JSON.stringify(err))
                connection.destroy();
                reject(false);
            }
        });

    });
}

async function check_update_order_is_original_image_done(order_id) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connection_db);
        let update_sql = "select case when is_original_image_created='Y' then 'Y' else 'N' end as checking from `order` where id=" + order_id;
        console.log("[" + order_id + "]check_update_order_is_original_image_done_sql:" + update_sql)
        connection.query(update_sql, (err, result) => {
            if (!err) {
                console.log("[" + order_id + "] check_update_order_is_original_image_done:" + result[0].checking)
                connection.destroy();
                if (result[0].checking === 'Y') {
                    resolve(true);
                } else {
                    resolve(false);
                }

            } else {
                console.log("[" + order_id + "]update_order_is_original_image_done: Err" + JSON.stringify(err))
                connection.destroy();
                reject(false);
            }
        });

    });
}

async function check_update_order_is_logo_image_done(order_id) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connection_db);
        let update_sql = "select case when is_logo_image_created='Y' then 'Y' else 'N' end as checking from `order` where id=" + order_id;
        console.log("[" + order_id + "]check_update_order_is_logo_image_done_sql:" + update_sql)
        connection.query(update_sql, (err, result) => {
            if (!err) {
                console.log("[" + order_id + "] check_update_order_is_logo_image_done:" + result[0].checking)
                connection.destroy();
                if (result[0].checking === 'Y') {
                    resolve(true);
                } else {
                    resolve(false);
                }

            } else {
                console.log("[" + order_id + "]update_order_is_logo_image_done: Err" + JSON.stringify(err))
                connection.destroy();
                reject(false);
            }
        });

    });
}

async function update_order_is_logo_image_done(order_id) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connection_db);
        let update_sql = "update `order` set is_logo_image_created = 'Y', is_logo_image_create_date = now() where id = " + order_id;
        console.log("[" + order_id + "]update_sql:" + update_sql)
        connection.query(update_sql, (err, result) => {
            if (!err) {
                connection.destroy();
                resolve(true);
            } else {
                console.log("[" + order_id + "]update_order_is_logo_image_done: Err" + JSON.stringify(err))
                connection.destroy();
                reject(false);
            }
        });

    });
}

async function send_email(order_id, confirm_key) {
    //OWNER_SECRET_KEY=QZ3c3mX9EIVFZS4O4h88EYygIMWnmVm4 sk
    console.log("[" + order_id + "]send_email.......n")
    return new Promise((resolve, reject) => {

        let data = {
            order_id: order_id,
            confirm_key: confirm_key,
            sk: "QZ3c3mX9EIVFZS4O4h88EYygIMWnmVm4"
        }
        console.log("email-noti request:", data)
        console.log("send_email url: https://myeventrunningapi.ishootrun.com/v1/cust-noti/email-noti")
        axios.post('https://myeventrunningapi.ishootrun.com/v1/cust-noti/email-noti', data, {
            headers: {
                "Content-Type": "application/json",
            }
        })
            .then(function (response) {
                // handle success
                console.log("[" + order_id + "]email-noti response: ", response.data);
                resolve(response.data)
            })
            .catch(function (error) {
                // handle error
                console.log("[" + order_id + "]email-noti error: ", error);
                reject(error)
            })
            .finally(function () {
                // always executed
                //console.log("finally");
            });

    });
}

async function send_sms(order_id, confirm_key) {
    //OWNER_SECRET_KEY=QZ3c3mX9EIVFZS4O4h88EYygIMWnmVm4 sk
    console.log("send_sms.......")
    return new Promise((resolve, reject) => {

        let data = {
            order_id: order_id,
            confirm_key: confirm_key,
            sk: "QZ3c3mX9EIVFZS4O4h88EYygIMWnmVm4"
        }
        console.log("[" + order_id + "]sms-noti request: ", data)
        console.log("send_sms url: https://myeventrunningapi.ishootrun.com/v1/cust-noti/sms-noti")
        axios.post('https://myeventrunningapi.ishootrun.com/v1/cust-noti/sms-noti', data, {
            headers: {
                "Content-Type": "application/json",
            }
        })
            .then(function (response) {
                // handle success
                console.log("[" + order_id + "]sms-noti response: ", response.data);
                resolve(response.data)
            })
            .catch(function (error) {
                // handle error
                console.log("[" + order_id + "]sms-noti error: ", error);
                reject(error)
            })
            .finally(function () {
                // always executed
                console.log("finally");
            });

    });
}






