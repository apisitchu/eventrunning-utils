const sharp = require("sharp");
const { v4: uuidv4 } = require('uuid');


async function getMetadata(image_name) {
    try {
        const metadata = await sharp(image_name).metadata();
        console.log(image_name + "_" + JSON.stringify(metadata.width));
        console.log(image_name + "_" + JSON.stringify(metadata.height));
    } catch (error) {
        console.log(`An error occurred during processing: ${error}`);
    }
}


async function resizeImage(image_name) {
    try {
        await sharp(image_name)
            .resize({
                width: 150,
                height: 97
            })
            .toFile("sammy-resized.png");
    } catch (error) {
        console.log(error);
    }
}


async function compositeImages(image_name, i) {
    try {
        
        await sharp(image_name)
            .resize({
                width: 4010
            })
            .composite([
                {
                    input: "frame_4000.png", blend: 'over'
                    
                },
            ])
            .webp({ quality: 50 })
            .toFile("imgs/"+i+".jpg")
        //.quality(10)
    } catch (error) {
        console.log(error);
    }
    console.log(i);
}

async function compositeImages_r(image_name, i) {
    try {
        const metadatab = await sharp(image_name).metadata();
        console.log("metadatab",metadatab)
        let img_byte = await sharp(image_name)
            .resize({
                width: 4010
            })
            .rotate()
            .webp({ quality: 50 })
            .toBuffer();

            const metadataa = await sharp(img_byte).metadata();
            console.log("metadataa",metadataa)
        //.quality(10)
    } catch (error) {
        console.log(error);
    }
    console.log(i);
}

getMetadata("img.jpg")
getMetadata("frame_v.png")

//resizeImage("img.jpg")
for (let i = 1; i <= 1; i++) {
    //compositeImages_r("_img.jpg", i+"x");
    compositeImages_r("img.jpg", i+"y");
}
