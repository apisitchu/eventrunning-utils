'use strict';
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sls = require("serverless-http");
const expressMultipartFileParser = require("express-multipart-file-parser");
const router = express.Router();
const AWS = require("aws-sdk");
const region = "ap-southeast-1"
AWS.config.update({ region: region });
const bucketName = "eventrunning-cloud";
const s3 = new AWS.S3();
const app = express();
const { v4: uuidv4 } = require('uuid');
var mysql = require('mysql');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const sqsClient = new SQSClient({ region: region });
const sharp = require("sharp");

const queue_url_1 = "https://sqs.ap-southeast-1.amazonaws.com/811048107221/eventrunning-tag-q";
const queue_url_2 = "https://sqs.ap-southeast-1.amazonaws.com/811048107221/eventrunning-tag-q2";

// const connection_db = {
//   host: 'thsv49.hostatom.com',
//   user: 'julius_phototh',
//   password: 'Livt407!1',
//   database: 'phototh',
// };
console.log("------ start -----")
const connection_db = {
  host: '49.229.76.150',
  port: '8800',
  user: 'admindb',
  password: 'itit@0909',
  database: 'eventrunningdb',
};


const start = async () => {
  try {
    console.log("------ start eventrunning-upload-file-lambda-v1.3.1 -----")

    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "https://my.eventrunning.photos");
      res.header("Access-Control-Allow-Methods", "GET, POST");
      res.header("Access-Control-Expose-Headers","set-cookie")
      res.header("Access-Control-Allow-Credentials",true)
      next();
    }); 

    app.use(bodyParser.json({ limit: "10mb" }));
    app.use(bodyParser.urlencoded({ limit: "10mb", extended: true }));
    app.use(expressMultipartFileParser.fileParser({
      rawBodyOptions: {
        limit: '10mb',
      },
    }));

    router.post('/upload-resize', async (req, res) => {

      let insertId = 0;
      try {

        console.log("let start upload resize...")
        const _file = req.files[0]
        const original_file_name = _file.originalname
        const event_id = req.body.event_id
        const photographer_id = req.body.photographer_id
        const event_key = req.body.event_key
        const event_watermark_hori = req.body.event_watermark_hori
        const event_watermark_vertical = req.body.event_watermark_vertical
        const is_free_download = req.body.is_free_download
        const is_add_watermark_for_free_download = req.body.is_add_watermark_for_free_download


        let check_isExitImage = await isExitImage(event_id, photographer_id, original_file_name)

        //console.log("req.files[0]",req.files[0])
        console.log("check_isExitImage:" + check_isExitImage+ ", "+original_file_name)
        if (check_isExitImage !== 'Y') {
          const upload_file_name = event_key + "/upload/" + uuidv4().replaceAll('-', '') + ".jpg"
          const external_image_Id = upload_file_name.substring(upload_file_name.lastIndexOf("/") + 1, upload_file_name.length);
          const preview_file_name = event_key + "/preview/" + uuidv4().replaceAll('-', '') + ".jpg"
          const thumbnail_file_name = event_key + "/thumbnail/" + uuidv4().replaceAll('-', '') + ".jpg"

          let insert_obj = {
            original_file_name: original_file_name,
            upload_file_name: upload_file_name,
            external_image_Id: external_image_Id,
            preview_file_name: preview_file_name,
            thumbnail_file_name: thumbnail_file_name,
            event_id: event_id,
            photographer_id: photographer_id,
            is_free_download: is_free_download,
            is_add_watermark_for_free_download: is_add_watermark_for_free_download,
            event_key: event_key,
            event_watermark_hori: event_watermark_hori,
            event_watermark_vertical: event_watermark_vertical

          }
          
          insertId = await insert_images(insert_obj)
          console.log("["+insertId+"]json body: " + original_file_name + ", " + event_id + ", " + photographer_id + ", " + event_key + ", " + event_watermark_hori + ", " + event_watermark_vertical)

          if (insertId !== 0) {
            console.log("["+insertId+"] rotate")
            let image_byte = await sharp(req.files[0].buffer).rotate().toBuffer()
            console.log("["+insertId+"] resizeImage")
            let image_buffer_resize = await resizeImage(image_byte)
            console.log("["+insertId+"] putObject")
            const params = {
              Bucket: bucketName,
              Key: upload_file_name,
              Body: image_buffer_resize
            };
            await s3.putObject(params).promise();
            console.log("["+insertId+"]push file to s3")
            let body_q = {
              image_id: insertId,
              event_id: insert_obj.event_id,
              photographer_id: insert_obj.photographer_id,
              upload_file_name: upload_file_name,
              preview_file_name: preview_file_name,
              thumbnail_file_name: thumbnail_file_name,
              event_key: insert_obj.event_key,
              event_watermark_hori: insert_obj.event_watermark_hori,
              event_watermark_vertical: insert_obj.event_watermark_vertical,
              is_free_download: insert_obj.is_free_download,
              is_add_watermark_for_free_download: insert_obj.is_add_watermark_for_free_download
            }

            const paramsQueue = {
              DelaySeconds: 1,
              MessageAttributes: {
                Author: {
                  DataType: "String",
                  StringValue: "photo-tag-id",
                }
              },
              MessageBody: JSON.stringify(body_q),
              QueueUrl: queue_url_1
            };

            const bodyMessageRes = await sqsClient.send(new SendMessageCommand(paramsQueue));

            res.status(200).json(
              {
                status: "success",
                body: bodyMessageRes,
              }
            )
          }
        } else {
          console.log("["+insertId+"][SKIP] upload")
          res.status(200).json(
            {
              status: "success",
              body: "skip upload",
            }
          )
        }
      } catch (err) {
        console.log("["+insertId+"] Exception: "+err.message)
        //delete this image
        let result_delete = await delete_images(insertId);
        console.log("["+insertId+"] delete image result:"+result_delete)
        res.status(400).json({
          status: "falied",
          message: err.message,
        });
      }
    });

    router.post('/upload', async (req, res) => {

      let insertId = 0;
      try {
        console.log("let start upload...")
        const _file = req.files[0]
        const original_file_name = _file.originalname
        const event_id = req.body.event_id
        const photographer_id = req.body.photographer_id
        const event_key = req.body.event_key
        const event_watermark_hori = req.body.event_watermark_hori
        const event_watermark_vertical = req.body.event_watermark_vertical
        const is_free_download = req.body.is_free_download
        const is_add_watermark_for_free_download = req.body.is_add_watermark_for_free_download
        const is_event_stage = req.body.is_event_stage
        const event_stage = req.body.event_stage


        let check_isExitImage = await isExitImage(event_id, photographer_id, original_file_name)

        console.log("check_isExitImage:" + check_isExitImage+ ", "+original_file_name)
        console.log("console.log('byteLength', _buffer.byteLength):"+_file.buffer.byteLength)
        if(_file.buffer.byteLength < 453265){
          res.status(400).json({
            status: "falied-size-not-support",
            message: {
              filesize: _file.buffer.byteLength,
              message: "Minimum file size 500KB"
            }
          });
        }
        if (check_isExitImage !== 'Y') {
          const upload_file_name = event_key + "/upload/" + uuidv4().replaceAll('-', '') + ".jpg"
          const external_image_Id = upload_file_name.substring(upload_file_name.lastIndexOf("/") + 1, upload_file_name.length);
          const preview_file_name = event_key + "/preview/" + uuidv4().replaceAll('-', '') + ".jpg"
          const thumbnail_file_name = event_key + "/thumbnail/" + uuidv4().replaceAll('-', '') + ".jpg"

          let insert_obj = {
            original_file_name: original_file_name,
            upload_file_name: upload_file_name,
            external_image_Id: external_image_Id,
            preview_file_name: preview_file_name,
            thumbnail_file_name: thumbnail_file_name,
            event_id: event_id,
            photographer_id: photographer_id,
            is_free_download: is_free_download,
            is_add_watermark_for_free_download: is_add_watermark_for_free_download,
            event_key: event_key,
            event_watermark_hori: event_watermark_hori,
            event_watermark_vertical: event_watermark_vertical,
            is_event_stage: is_event_stage,
            event_stage: event_stage,

          }

          
          insertId = await insert_images(insert_obj)
          console.log("["+insertId+"] json body: " + original_file_name + ", " + event_id + ", " + photographer_id + ", " + event_key + ", " + event_watermark_hori + ", " + event_watermark_vertical)

          if (insertId !== 0) {

            const params = {
              Bucket: bucketName,
              Key: upload_file_name,
              Body: _file.buffer
            };
            await s3.putObject(params).promise();
            console.log("["+insertId+"]push file to s3")
            let body_q = {
              image_id: insertId,
              event_id: insert_obj.event_id,
              photographer_id: insert_obj.photographer_id,
              upload_file_name: upload_file_name,
              preview_file_name: preview_file_name,
              thumbnail_file_name: thumbnail_file_name,
              event_key: insert_obj.event_key,
              event_watermark_hori: insert_obj.event_watermark_hori,
              event_watermark_vertical: insert_obj.event_watermark_vertical,
              is_free_download: insert_obj.is_free_download,
              is_add_watermark_for_free_download: insert_obj.is_add_watermark_for_free_download
            }

            let queue_select = queue_url_1;
            let number = (Math.floor(Math.random() * 2) + 1)
            if (number !== 1) {
              queue_select = queue_url_2;
            }
            console.log("["+insertId+"] queue_select:"+queue_select)
            const paramsQueue = {
              DelaySeconds: 1,
              MessageAttributes: {
                Author: {
                  DataType: "String",
                  StringValue: "photo-tag-id",
                }
              },
              MessageBody: JSON.stringify(body_q),
              QueueUrl: queue_select
            };

            const bodyMessageRes = await sqsClient.send(new SendMessageCommand(paramsQueue));

            res.status(200).json(
              {
                status: "success",
                body: bodyMessageRes,
              }
            )
          }
        } else {
          console.log("[SKIP] upload")
          res.status(200).json(
            {
              status: "success",
              body: "skip upload",
            }
          )
        }
      } catch (err) {
        
        res.status(400).json({
          status: "falied",
          message: err.message,
        });
      }
    });

    router.get('/', async (req, res) => {
      console.log("router get:", req)
      res.status(200).json({ api: 'eventrunning file upload 1.0.0' })
    });
    router.post('/test', async (req, res) => {
      console.log("router get post:", req)
      res.status(200).json({ api: 'eventrunning file upload 1.0.0' })
    });
    app.use('/', router)
    app.listen(3001, function () {
      console.log("eventrunning file upload 1.0.0 is listening on port 3001");
    });
  }
  catch (err) {
    console.log("Exception: "+err.message)
    res.status(400).json({
      status: "falied",
      message: err.message,
    });
  }
};


async function insert_images(insert_obj) {
  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection(connection_db);
    let sql = "INSERT INTO images (original_file_name, external_image_Id ,upload_file_name,preview_file_name,thumbnail_file_name, event_id, photographer_id,stage_id, create_date) ";
    sql += "VALUES('" + insert_obj.original_file_name + "','" + insert_obj.external_image_Id + "','" + insert_obj.upload_file_name + "','" + insert_obj.preview_file_name + "','" + insert_obj.thumbnail_file_name + "'," + insert_obj.event_id + "," + insert_obj.photographer_id + "," + insert_obj.event_stage + ",NOW()) ";
    connection.query(sql, (err, result) => {
      if (!err) {
        connection.destroy();
        resolve(result.insertId);
      } else {
        console.log("[" + insert_obj.original_file_name + "]insert_images: Err" + JSON.stringify(err))
        connection.destroy();
        reject(0);
      }
    });


  });
}

async function delete_images(_insertId) {
  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection(connection_db);
    let sql = "delete from images where id = "+_insertId+" limit 1 ";
    
    connection.query(sql, (err, result) => {
      if (!err) {
        connection.destroy();
        resolve(true);
      } else {
        console.log("[" + _insertId + "]delete_images: Err" + JSON.stringify(err))
        connection.destroy();
        reject(false);
      }
    });


  });
}

async function isExitImage(event_id, photographer_id, original_file_name) {
  return new Promise((resolve, reject) => {
    const connection = mysql.createConnection(connection_db);
    let sql_check_exsit = "select id from images where event_id = " + event_id + " and photographer_id = " + photographer_id + " and original_file_name='" + original_file_name + "'"
    connection.query(sql_check_exsit, (err, result) => {
      if (!err) {
        connection.destroy();
        if (result.length > 0) {
          resolve("Y");
        } else {
          resolve("N");
        }
      } else {
        console.log("[" + image_id + "]update_image_taged: Err" + JSON.stringify(err))
        connection.destroy();
        reject(false);
      }
    });

  });
}



async function resizeImage(_image_byte){
  const image_metadata = await sharp(_image_byte).metadata();
  if (image_metadata.width > image_metadata.height) {
      return await sharp(_image_byte)
      .resize({
          width: 4300,
          height: 2868
      })
      .toBuffer();

  }else{
    return await sharp(_image_byte)
    .resize({
        width: 2868,
        height: 4300
    })
    .toBuffer();

  }

}

start();
module.exports.server = sls(app);
