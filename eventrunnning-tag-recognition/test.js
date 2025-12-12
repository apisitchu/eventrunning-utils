const sharp = require("sharp");
const exifReader = require('exif-reader');

//let fileP = "./4KP_5162.JPG"
//const image_metadata = sharp(fileP).metadata();

//console.log("image_metadata:"+JSON.stringify(image_metadata))
//const exif = exifReader(image_metadata.exif)

async function update_image_taged(d) {
    return new Promise((resolve, reject) => {
        console.log("d:"+d)
    });
}

async function getMetadata(image_name) {
    try {
        const metadata = await sharp(image_name).metadata();
        console.log(image_name + "_" + JSON.stringify(metadata.width));
        console.log(image_name + "_" + JSON.stringify(metadata.height));

    //console.log("image_metadata:"+JSON.stringify(metadata))
    const exif = exifReader(metadata.exif)

    let dateTimeOriginal = exif.Photo.DateTimeOriginal
    console.log("DateTimeOriginal:",dateTimeOriginal);
    console.log("DateTimeOriginalv2:"+dateTimeOriginal)
    console.log("DateTimeOriginalv3:"+JSON.stringify(dateTimeOriginal))
    let datestr = JSON.stringify(dateTimeOriginal);
    console.log("datestr:"+datestr.replaceAll('"',''))
    console.log("datestrv2:"+datestr.substring(1,20).replaceAll('T',' '))
    await update_image_taged(dateTimeOriginal)
    } catch (error) {
        console.log(`An error occurred during processing: ${error}`);
    }
}

getMetadata("4KP_5162.JPG")