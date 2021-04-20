/* global ec2 */

var AWS = require('aws-sdk');
var ec2 = new AWS.EC2();

exports.handler = async (event) => {
    
    var result = '{  "instancesList":{';
    
    result += await getListOfInstances();
    
    console.log(result);
    
    return JSON.parse(result); 
};

function getListOfInstances(){
    var params = {};    
    
    return new Promise(resolve =>  ec2.describeInstances(params, function(err, data) { // gets all data about all instances
        var instancesList = '';
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log(data);           // successful response
        
        for(var i = 0; i < data.Reservations.length; i++){ // filters info about instances
            var instance = data.Reservations[i].Instances[0];
            if (instance.State.Name == 'running'){
                instancesList += ( '"' + (i+1) + '":{' +  '"id":"' + instance.InstanceId + '",' + '"type":"' + instance.InstanceType + '",' + '"date":"' + instance.LaunchTime + '",' + '"state":"' + instance.State.Name + '"}');
                if (i+1 < data.Reservations.length){
                    instancesList += ',';
                }
            }
        }
        instancesList += '},';
        instancesList += '"logs": [ "GetListOfInstances: everything worked fine!" ]'
        instancesList += '}';
        resolve (instancesList);
    }));
    
    // data format can be found: https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#describeInstances-property
}