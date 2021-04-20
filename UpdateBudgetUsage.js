/* global request */
const AWS = require('aws-sdk');
var s3 = new AWS.S3();

exports.handler = async (event) => { 
    
   var instancesList = inputToArray(event.instancesList);                       // gather input usage array [instance counter][id, type, time worked, state]
   
   var instancesBudgetString = await getUsageBudgetString();                    // gather budget from s3 { "budget":[type, time planned], "whitelist":[id], "usage":"month"[type, time_used] }
   
   var instancesBudget = getBudget(instancesBudgetString);                      // get array of budgeted types of instances (from file)

   var instancesWhitelist = getWhitelist(instancesBudgetString);                // get array of whitelisted instances (from file)
   
   var instancesUsage = getMonthlyUsage(instancesBudgetString);                 // gathers current usage of instances (from file)
   
   instancesList = eraseWhitelisted(instancesList, instancesWhitelist);         // remove whitelisted instances from usage array 
   
   var instancesUsage = calculateUsage(instancesUsage, instancesList);          // calculates current usage 
   
   var newbudget = updateUsage(instancesBudgetString, instancesUsage);          // gathers all JSON with budget, whitelist, current usage
   
   var uploadStatus = await uploadDocument(newbudget);                          // puts updated usage to S3 bucket
   
   var complianceStatus = budgetComliance(instancesBudget, instancesUsage);     // Detects types over budget
   
   var terminationList = complianceCheck(complianceStatus, instancesList);      // Detects running instances over budget
   
   var result = cmdGenerator(terminationList);
   
   console.log("Result = ", result);
   
   return result;
};

function getOverusedInstances(usage, types){
    var ids = [];
    
    for(let i = 0; i < types.length; i++){
        for (let j = 0; j < usage.length; j++){
            if ( (types[i] == usage[j][1]) && (usage[j][3] == "running") ){
                ids.push(usage[j][0]);
            }
        }
    }
    
    //console.log("Overused instances Ids are " + ids);
    return ids;
}

function getOverusedTypes(usage, budget){
    var types = [];
    
    for (let i = 0; i+1 < budget.length; i += 2){
        var timer = 0;
        for (let j = 0; j < usage.length; j++){
            if (budget[i] == usage[j][1]){      // same type
                timer += usage[j][2];
            }
        }
        if (timer >= budget[i+1]){
            console.log("overbudget = ", budget[i]);
            types.push(budget[i]);              // overused type
        }
    }
    
    //console.log("getOverusedTypes found " + types);
    return types;
}

function eraseWhitelisted(Usage, Whitelist){
    
    //console.log("Error happened here: " + Usage);
    for (let i = 0; i < Whitelist.length; i++){
        for (let j = 0; j < Usage.length; j ++){
            if (Usage[j][0] == Whitelist[i]){
                Usage.splice(j, 1);
            }
        }
    }
    console.log("erased Whitelist = " + Usage);
    return Usage;
}

function getMonthlyUsage(budgetString){

    var jsonBudget = JSON.parse(budgetString);
    
    var date = getMonth();
    
    var usageJSON = jsonBudget.usage[date]; // JSON of Usage
    
    var strRaw = JSON.stringify(usageJSON);
  
    var strCln = strRaw.match( /[a-zA-Z0-9.]+/g ) + '';
  
    var arr = strCln.split(","); // Array of [type1, time1,..,..]
    
    console.log("arr = " + arr);
    
    return arr; 
}

function getMonth(){
  var date = new Date();
  var month = date.getMonth() + 1;
  var year = date.getFullYear();
  
  return ('m' + month + '_' + year);
}

function getWhitelist(budgetString){
    var jsonBudget = JSON.parse(budgetString);
    
    var result = jsonBudget.whitelist;
    
    //console.log("getWhitelist result = ", result);
    return result;
}

function getBudget(budgetString){
    var jsonBudget = JSON.parse(budgetString);
    
    var result = jsonBudget.instances;
    
    //console.log("getBudget result = ", result);
    return result;
}

function calculateUsage(instancesUsage, instancesList){ 
    // [type1,usage1,..] 

    var minutesFrequency = 5;

    console.log("before = " + instancesUsage);

    for(var i = 1; i < instancesUsage.length; i+=2){
        instancesUsage[i] = parseInt(instancesUsage[i], 10);      // makes every usage to int
    }
    
    for(var i = 0; i < instancesList.length; i++){
        for(var j = 0; j < instancesUsage.length/2; j++){
            if(instancesList[i][1] == instancesUsage[j*2])
                instancesUsage[j*2+1] += minutesFrequency;         // value
        }
    }
    
    for(var i = 1; i < instancesUsage.length; i+=2){
        instancesUsage[i] = instancesUsage[i] + '';
    }
    
    console.log("after = " + instancesUsage);
    
    return instancesUsage;
}

function budgetComliance(instancesBudget, instancesUsage){
    var result = [];
    
    for(var i = 0; i < instancesBudget.length; i += 2){
        for(var j = 0; j < instancesUsage.length; j += 2){
            if (instancesBudget[i] == instancesUsage[j]){
                if (instancesBudget[i+1] <= instancesUsage[j+1]){
                    result.push(instancesBudget[i]);
                }
            }
        }
    }
    
    console.log("out of compliance = " + result);
    console.log("instancesBudget = " + instancesBudget);
    console.log("instancesUsage = " + instancesUsage);
    
    return result;
}

function complianceCheck(complianceStatus, instancesList){
    var terminationList = [];

    for(var i = 0; i < instancesList.length; i ++){
        for(var j = 0; j < complianceStatus.length; j++){
            if (instancesList[i][1] == complianceStatus[j]){
                terminationList.push(instancesList[i][0]);
            }
        }
    }
    return terminationList;
}

function cmdGenerator(terminationList){
    var result = '{"instances": [';
    for(let i=0; i < terminationList.length; i++){       
        result += '"' + terminationList[i] + '"';
        if (i < (terminationList.length - 1) )
            result += ',';
    }
    result += '],  "logs": [    "GetInstancesUsage is fine!  GetInstancesUsage is fine! Compare Usage Plan worked!"   ]}';
    result = JSON.parse(result);
    return result;
}

// async part

async function uploadDocument(newbudget){
    var string = JSON.stringify(newbudget);
    
    var params = {
        Body: string, 
        Bucket: "ec2-usage-budget-bucket", 
        Key: "newbudget.txt"
    };
    
    return new Promise((resolve, reject)=> {
        
        s3.putObject(params, function(err, data) {
            if (err) {
                console.log(err, err.stack);                               // an error occurred
                reject("Error: Upload failed");
            }
            else {
                console.log("DATA UPLOADED = " + data);                    // successful response
                resolve("Upload Successful");
            }
        });
    });
}

function getUsageBudgetString(){
    return new Promise((resolve, reject)=> { 
        var params = {
            Bucket: "ec2-usage-budget-bucket", 
            Key: "newbudget.txt",                  // doesnt work on empty documents - endless cycle 
            Range: "text/*"
        };

        const result = streamToString(params);
        
        resolve(result);
    });
}

async function streamToString (params) {
    const readStream = s3.getObject(params).createReadStream();
    return new Promise((resolve, reject) => {
        readStream.on('data', (chunk) => { 
            //console.log(chunk.toString());
            resolve(chunk.toString() );
        });
    })
}

function inputToArray(inputStr){
    var arr = [];
    var i = 0;
    for(var key in inputStr){
        arr[i] = new Array(3);
        arr[i][0] = inputStr[key].id;
        arr[i][1] = inputStr[key].type;
        arr[i][2] = inputStr[key].state;
        //console.log("key = " + key + " value = " + arr[i][0]);
        i++;
    }
    //console.log("arr = " + arr);
    return arr;
}

function getLogs(input){
    for(var key in input)
        return input[key];
}

function updateUsage(instancesBudgetString, instancesUsage){
    var jsonBudget = JSON.parse(instancesBudgetString);
    
    var date = getMonth();
    
    jsonBudget.usage[date] = JSON.stringify(instancesUsage);
    
    //console.log("JSON final = ", jsonBudget);
    
    return jsonBudget;
}