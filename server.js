var express = require('express');
var mysql = require('mysql');
var Client = require('ssh2').Client;
var WebHDFS = require('webhdfs');

var app = express();

app.use(function (req,res, next) {
    res.header('Access-Control-Allow-Origin',"*");
    res.header('Access-Control-Allow-Methods',"GET, PUT, POST, DELETE");
    res.header('Access-Control-Allow-Headers',"Content-Type");
    next();
});

app.get('/something', function(req,res, next){
    var connection = mysql.createConnection({
        host     : '54.213.168.181',
        user     : 'root',
        password : 'BigData@1',
        database : 'datamorphix'
    });

    connection.connect();

    connection.query('SELECT TCD_Id from dm_cluster_master', function (err, rows, fields) {
        if (err) throw err;

        console.log('The solution is: ', rows)
    });

    connection.end();


    res.send('works');

});


app.get('/ssh', function (req,res, next) {

    var conn = new Client();
    conn.on('ready', function() {
        console.log('Client :: ready');
        conn.exec('uptime', function(err, stream) {
            if (err) throw err;
            stream.on('close', function(code, signal) {
                console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                conn.end();
            }).on('data', function(data) {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', function(data) {
                console.log('STDERR: ' + data);
            });
        });
    }).connect({
        host: '54.244.100.147',
        port: 22,
        username: 'bluedata',
        privateKey: require('fs').readFileSync('./keys/BD_demotenant.pem')
    });
});
