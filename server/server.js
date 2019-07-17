const mongoose = require('mongoose');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const moment = require('moment');
const _ = require('lodash');

http.listen('1337', function(){
    console.log('================ RUNNING SERVER ================');
    console.log('Ready on port 1337.');
});

mongoose.connect('mongodb://127.0.0.1:27017/efk_demo_db', {useNewUrlParser: true});

const schema = new mongoose.Schema({
    visitor_id: Number,
    action: String,
    user_agent: String,
    referer: String,
    created_at: { type: Date, default: Date.now },
});
const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', schema, 'activity_logs');

const getExistLogs = async () => {
    let logs = [];
    logs = await ActivityLog.aggregate([
        { "$group": {
            "_id": {
                "year": { "$year": "$created_at" },
                "month": { "$month": "$created_at" },
                "date": { "$dayOfMonth": "$created_at" },
                "hour": { "$hour": "$created_at" },
                "minute": { "$minute": "$created_at" },
            },
            total: { $sum: 1 }
        }},

        { $project : {
            "_id": 0,
            year: "$_id.year",
            month: "$_id.month",
            date: "$_id.date",
            hour: "$_id.hour",
            minute: "$_id.minute",
            total : "$total" 
        } },
        {$sort:{"year":1, "month":1, "date":1, "hour":1, "minute":1}}
    ]).allowDiskUse(true);
    return logs;
};

const calculateTotalRequest = (logsData, currentLog) => {
    let totalRequest = 0;
    const validLogs = _.filter(logsData, (log) => {
        return (currentLog.time >= log.time);
    });
    validLogs.forEach((log) => {
        totalRequest += log.total;
    });
    return totalRequest;
}

io.sockets.on('connection', async (socket) => {
  console.log('a user connected');
    const existLogs = await getExistLogs();
    const logsData = _.map(existLogs, (log) => {
        log.time = moment().year(log.year).month(log.month - 1).date(log.date).hour(log.hour).minute(log.minute).second(0).valueOf(); 
        return log;
    });
    const xLogs = _.sortBy(logsData, ['time']);
    const xxLogs = [];
    xLogs.forEach((log) => {
        xxLogs.push([log.time, calculateTotalRequest(xLogs, log)]);
    });
    socket.emit('initial', xxLogs);
    setInterval(async () => {
        const executingTime = moment(); //.subtract(1, 'days');
        const count = await ActivityLog.countDocuments({
            "created_at" : { "$lt" : executingTime.toDate()}
        });
        io.sockets.emit('refresh_chart', {time: executingTime.format('YYYY-MM-DD HH:MM:SS'),timestamp: executingTime.valueOf(), number_request: count});
    }, 1000);
});
