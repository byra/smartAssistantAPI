var express = require('express');
var mysql = require('mysql');
var Client = require('ssh2').Client;
var WebHDFS = require('webhdfs');
var cities = require('cities');
var madison = require('madison');

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


function sshIntoCluster(zipCode, res){
    let conn = new Client();
    conn.on('ready', function() {
        console.log('Client :: ready');
        conn.shell(function(err, stream) {
            if (err) throw err;
            stream.on('close', function() {
                console.log('Stream :: close');
                conn.end();
                getHDFS(res,'/bdaas/src/zomato/merged_classifier_output/classifier_mergedata.txt');
            }).on('data', function(data) {
                console.log('STDOUT: ' + data);
            }).stderr.on('data', function(data) {
                console.log('STDDATA: ' + data);
            });
            stream.end('spark-submit /bdaas/exe/spark_zomato_input/spark_insights_input.py '+zipCode+'\nexit\n');

        });

    }).connect({
        host: '54.244.100.147',
        port: 22,
        username: 'bluedata',
        privateKey: require('fs').readFileSync('./keys/BD_demotenant.pem')
    });
}

app.get('/get_restaurant', function (req,res,next) {

    let parameters = JSON.parse(req.query.parameters);
    let zipCode;
    if(parameters.zipCode){
        zipCode = parameters.zipCode;
    }
    else if(parameters.byName){
        zipCode = cities.findByCityAndState(parameters.byName.city,madison.getStateAbbrevSync(parameters.byName.state)).zipcode;
    }
    else if(parameters.byCoordinates){
        let coordinates = parameters.byCoordinates.split(",");
        zipCode = cities.gps_lookup(Number(coordinates[0]),Number(coordinates[1])).zipcode;
    }

    if(!zipCode){
        getHDFS(res, '/bdaas/src/zomato/zomato_data.txt');
    }
    else{
        console.log("before ssh");
        sshIntoCluster(zipCode, res);

    }



});


function getHDFS(res, fileLocationURL) {
    let result = [];
    let hdfs = WebHDFS.createClient({
        user:'bluedata',
        host:'10.0.189.10',
        port:50070,
        path:'/webhdfs/v1'
    });

    let remoteFileStream = hdfs.createReadStream(fileLocationURL);

    remoteFileStream.on('error', function onError (err) {
        // Do something with the error
        console.log(err.toString())
    });

    remoteFileStream.on('data', function onChunk (chunk) {
        let column_list = ["comment_count","foodie_color","likes", "profile_image","profile_url","rating","rating_color","rating_text","rating_time_friendly","restaurant_id","retrieved_time","review_id","review_text","time_stamp","user_foodie_level","user_level_num","user_name","user_zomatohandle","class_name","confidence","score"];
        let reviews = chunk.toString().split(/\n/);
        for(let review of reviews){
            let object = {};
            let data = review.split('|');
            column_list.forEach(function (k, i) {
                object[k] = data[i];
            });
            result.push(object);
        }
        res.end(JSON.stringify(result));
    });

    remoteFileStream.on('finish', function onFinish () {
        // Upload is done
        console.log('in finished')
    });
}

app.listen(3030);