const Jimp = require('jimp')

async function comp(image_name, i){
    let image = (await Jimp.read(image_name)).quality(40);
    let watermark = await Jimp.read("frame_v.png");

    await image.composite(watermark, 0, 0, {
        mode: Jimp.BLEND_SOURCE_OVER,
        opacityDest: 1,
        opacitySource: 1

    })
    await image.write("imgjip/"+i+".jpg").quality(40)
    console.log(i)
}

for (let i = 1; i <= 10; i++) {
    comp("img.jpg", i);
}
