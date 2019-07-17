const mongoose = require('mongoose');
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const moment = require('moment');
const _ = require('lodash');

http.listen('3004', function(){
    console.log('================ RUNNING SERVER ================');
    console.log('Ready on port 3004.');
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
    const loggingTime = moment();
    for(let i = 1; i <= 300; i ++) {
        const count = await ActivityLog.countDocuments({
            "created_at" : { "$lt" : loggingTime.subtract(5 * (i - 1), 'seconds').toDate()},
            "created_at" : { "$gte" : loggingTime.clone().subtract(5 * i, 'seconds').toDate()}
        });
        logs.push([loggingTime.subtract(5 * (i - 1), 'seconds').valueOf(), count]);
    }
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
    // const logsData = await getExistLogs();
    socket.emit('initial', []);
    setInterval(async () => {
        const executingTime = moment(); //.subtract(1, 'days');
        const count = await ActivityLog.countDocuments({
            "created_at" : { "$lt" : executingTime.toDate()},
            "created_at" : { "$gte" : executingTime.clone().subtract(5, 'seconds').toDate()}
        });
        io.sockets.emit('refresh_chart', {time: executingTime.format('YYYY-MM-DD HH:MM:SS'),timestamp: executingTime.valueOf(), number_request: count});
    }, 5000);
});
