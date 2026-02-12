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
const exifReader = require('exif-reader');

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

exports.handler = async function (event) {

    let countMsg = 0;
    for (const message of event.Records) {

        let message_json = JSON.parse(JSON.stringify(message))
        let queueMsg = JSON.parse(message_json.body)
        console.log("queueMsg: " + JSON.stringify(queueMsg));

        const collectionName = queueMsg.event_key;
        const upload_file_name = queueMsg.upload_file_name;
        const preview_file_name = queueMsg.preview_file_name;
        const thumbnail_file_name = queueMsg.thumbnail_file_name;
        const image_id = queueMsg.image_id;
        //const event_watermark_hori = queueMsg.event_watermark_hori;
        //const event_watermark_vertical = queueMsg.event_watermark_vertical;

        const event_watermark_hori = "assest/watermark/wtm_hori.png";
        const event_watermark_vertical = "assest/watermark/wtm_verti.png";
        //const event_thumbnail_watermark_hori = "assest/watermark/tmn_wtm_hori.png";
        //const event_thumbnail_watermark_vertical = "assest/watermark/tmn_wtm_verti.png";
        const is_free_download = queueMsg.is_free_download;
        const event_key = queueMsg.event_key;
        const is_add_watermark_for_free_download = queueMsg.is_add_watermark_for_free_download;
        const free_event_watermark_hori = event_key+'/free_event_frame_hori.png'
        const free_event_watermark_vertical = event_key+'/free_event_frame_verti.png'
        

        const quality_const = 80
        const width_preview = 725
        const height_preview = 483
        const width_thumbnail = 300
        const height_thumbnail = 200
        const width_minimum_image_accept = 3900

        const width_original_resize = 4300
        const height_original_resize = 2864

        try {
            console.log("["+image_id+"]check image tag...");
            let is_taged = await isImageTaged(image_id);
            console.log("["+image_id+"]is_taged: " + is_taged);
    
            if (!is_taged) {
    
              const image_byte_s3 = await getObject_(upload_file_name);
    
                let image_byte = await sharp(image_byte_s3).withMetadata().rotate().toBuffer()
                const image_metadata = await sharp(image_byte).metadata();

                //console.log("image_metadata:",image_metadata);
                //console.log("exif:",image_metadata.exif);
                const exif = exifReader(image_metadata.exif)
                if (image_metadata.width >= image_metadata.height) {
                    //const image_byte_tmn_watermark_hori = await getObject_(event_thumbnail_watermark_hori);

                    if (is_free_download !== 'Y') {
                        const image_byte_watermark_hori = await getObject_(event_watermark_hori);
                        
                        let image_buffer_preview = await sharp(image_byte)
                            .resize({
                                width: width_preview,
                                height: height_preview
                            })
                            .composite([
                                {
                                    input: image_byte_watermark_hori
                                },
                            ])
                            //.webp({ quality: quality_const })
                            .toBuffer();
                        await pushObject_(image_buffer_preview, preview_file_name);
                    }
                    //console.log("preview_file_name done");
    
                    let image_buffer_thumbnail = await sharp(image_byte)
                        .resize({
                            width: width_thumbnail,
                            height: height_thumbnail
                        })
                        // .composite([
                        //     {
                        //         input: image_byte_tmn_watermark_hori
                        //     },
                        // ])
                        //.webp({ quality: quality_const })
                        .toBuffer();
                    await pushObject_(image_buffer_thumbnail, thumbnail_file_name);
    
                    console.log("["+image_id+"][tagFace start]")
                    await tagFace(collectionName, upload_file_name, image_id)
                    console.log("["+image_id+"][tagFace done]" + upload_file_name)

                    //resize and is_add_watermark_for_free_download
                    console.log("image_metadata.width:"+image_metadata.width)
                    console.log("width_original_resize:"+width_original_resize)
                    if(is_add_watermark_for_free_download === 'Y'){
                        //resize and is_add_watermark_for_free_download
                        const image_byte_free_watermark_hori = await getObject_(free_event_watermark_hori);
                        let image_buffer_original = await sharp(image_byte)
                        .withMetadata()
                        .resize({
                            width: width_original_resize+5
                        })
                        .composite([
                            {
                                input: image_byte_free_watermark_hori
                            },
                        ])
                        .jpeg({ quality: quality_const })
                        .toBuffer();
                         await pushObject_(image_buffer_original, upload_file_name);

                    }else{
                        //resize only
                        let image_buffer_original = await sharp(image_byte)
                        .withMetadata()
                        .resize({
                            width: width_original_resize
                        })
                        .jpeg({ quality: quality_const })
                        .toBuffer();
                         await pushObject_(image_buffer_original, upload_file_name);
                    }
                    
                    

    
                } else {
                    //const image_byte_tmn_watermark_vertical = await getObject_(event_thumbnail_watermark_vertical);
                    
                    if (is_free_download !== 'Y') {
                        const image_byte_watermark_vertical = await getObject_(event_watermark_vertical);
                        
                        let image_buffer_preview = await sharp(image_byte)
                            .resize({
                                width: height_preview,
                                height: width_preview
                            }).composite([
                                {
                                    input: image_byte_watermark_vertical
                                },
                            ])
                            //.webp({ quality: quality_const })
                            .toBuffer();
                        await pushObject_(image_buffer_preview, preview_file_name);
                    }
                    let image_buffer_thumbnail = await sharp(image_byte)
                        .resize({
                            width: height_thumbnail,
                            height: width_thumbnail
                        })
                        // .composite([
                        //     {
                        //         input: image_byte_tmn_watermark_vertical
                        //     },
                        // ])
                        //.webp({ quality: quality_const })
                        .toBuffer();
                    await pushObject_(image_buffer_thumbnail, thumbnail_file_name);
    
                    console.log("["+image_id+"][tagFace start]")
                    let faceid = await tagFace(collectionName, upload_file_name, image_id)
                    console.log("["+image_id+"][tagFace done]" + upload_file_name + ", image_id:" + image_id)

                    //resize and is_add_watermark_for_free_download
                    console.log("image_metadata.height:"+image_metadata.height)
                    console.log("width_original_resize:"+width_original_resize)

                    if(is_add_watermark_for_free_download === 'Y'){
                        //resize and is_add_watermark_for_free_download
                        const image_byte_free_watermark_vertical = await getObject_(free_event_watermark_vertical);
                        let image_buffer_original = await sharp(image_byte)
                        .withMetadata()
                        .resize({
                            height: width_original_resize+5
                        }).composite([
                            {
                                input: image_byte_free_watermark_vertical
                            },
                        ])
                        .jpeg({ quality: quality_const })
                        .toBuffer();
                        await pushObject_(image_buffer_original, upload_file_name);
                    

                    }else{
                        //resize only
                    let image_buffer_original = await sharp(image_byte)
                        .withMetadata()
                        .resize({
                            height: width_original_resize
                        })
                        .jpeg({ quality: quality_const })
                        .toBuffer();
                        await pushObject_(image_buffer_original, upload_file_name);
                    }

                    
                }
    
                let dateTimeOriginal = exif.Photo.DateTimeOriginal
                console.log("DateTimeOriginal:",dateTimeOriginal);
                console.log("["+image_id+"]Start update..." + image_id + ":" + await update_image_taged(image_id,dateTimeOriginal))
    
            } else {
                console.log("["+image_id+"]image_id taged: skip")
            }
    
        } catch (e) {
            console.log("["+image_id+"] Exception :", e)
        }
        countMsg++

    }
    console.log("countMsg:" + countMsg);

};

async function getObject_(keyName) {

    const params = {
        Bucket: bucketName,
        Key: keyName
    }

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

async function tagFace(collectionName, upload_file_name, image_id) {

    const externalImageId = '' + image_id;
    const paramsIndexFace = {
        CollectionId: collectionName,
        DetectionAttributes: [],
        ExternalImageId: externalImageId,
        Image: {
            S3Object: {
                Bucket: bucketName,
                Name: upload_file_name
            }
        }
    };

    //console.log("paramsIndexFace: " + JSON.stringify(paramsIndexFace));
    const indexFacesCommand = new IndexFacesCommand(paramsIndexFace);
    //console.log("indexFacesCommand: " +JSON.stringify(indexFacesCommand));
    const dataIndex = await rekognitionClient.send(indexFacesCommand);

    //console.log("dataIndex: " + JSON.stringify(dataIndex));
    //get faceid
    var message = upload_file_name + " index created"
    return message;

}



async function update_image_taged(image_id,d) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connection_db);
        console.log("d:"+d);
        let update_sql = "";
        if(d === undefined || d == null || d.length <= 0){
            update_sql = "update `images` set tag = 1, tag_date = now(),taken_date = now() where id = " + image_id;
        }else{
            let date_string_temp = JSON.stringify(d);
            console.log("date_string_temp:"+date_string_temp)
            if(date_string_temp.length >25){
                let date_string = date_string_temp.substring(1,20).replaceAll('T',' ')
                update_sql = "update `images` set tag = 1, tag_date = now(),taken_date = '"+date_string+"' where id = " + image_id;
            }else{
                update_sql = "update `images` set tag = 1, tag_date = now(),taken_date = now() where id = " + image_id;
            }   
        }
        console.log("update_sql:"+update_sql);
        connection.query(update_sql, (err, result) => {
            if (!err) {
                connection.destroy();
                resolve(true);
            } else {
                console.log("[" + image_id + "]update_image_taged: Err" + JSON.stringify(err))
                connection.destroy();
                reject(false);
            }
        });

    });
}


async function isImageTaged(image_id) {
    return new Promise((resolve, reject) => {
        const connection = mysql.createConnection(connection_db);
        let check_sql = "select case when tag=1 then 'Y' else 'N' end as checking from images where id =" + image_id;
        connection.query(check_sql, (err, result) => {
            if (!err) {

                connection.destroy();
                if (result[0].checking === 'Y') {
                    resolve(true);
                } else {
                    resolve(false);
                }


            } else {
                console.log("[" + image_id + "]update_image_taged: Err" + JSON.stringify(err))
                connection.destroy();
                reject(false);
            }
        });

    });
}



