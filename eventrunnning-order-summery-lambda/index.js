
const axios = require('axios')

exports.handler = async function (event, context, callback) {

    const queueMsg = JSON.parse(event.Records[0].body);
    console.log("queueMsg: " + JSON.stringify(queueMsg));
    const order_id = queueMsg.order_id;
    const confirm_key = queueMsg.confirm_key;
    const event_key = queueMsg.event_key;
    const event_id = queueMsg.event_id;


    console.log("order_id: " + order_id);
    console.log("confirm_key: " + confirm_key);
    console.log("event_key: " + event_key);
    console.log("event_id: " + event_id);

    const _r = await order_summery(order_id, confirm_key,event_key,event_id)
    console.log("_r json: " + JSON.stringify(_r))

};

async function order_summery(order_id, confirm_key,event_key,event_id) {
    //OWNER_SECRET_KEY=QZ3c3mX9EIVFZS4O4h88EYygIMWnmVm4 sk
    console.log("order_summery.......")
    return new Promise((resolve, reject) => {

        let data = {
            order_id: order_id,
            confirm_key: confirm_key,
            event_key: event_key,
            event_id: event_id,
            sk: "QZ3c3mX9EIVFZS4O4h88EYygIMWnmVm4"
        }
        console.log("order_summery data", data)

        axios.post('https://myeventrunningapi.ishootrun.com/v1/order-summery/summery', data, {
            headers: {
                "Content-Type": "application/json",
            }
        })
            .then(function (response) {
                // handle success
                console.log("order_summery: " + response.data);
                resolve(response.data)
            })
            .catch(function (error) {
                console.log(error);
                reject(error)
            })
            .finally(function () {
                // always executed
                console.log("finally");
            });
    });
}






