// Calls a powershell script on my local machine
// Node server can call this when it is time to show the QR Page
// It will resize the existing Chrome Window to full window so it will block the Trackman GUI

var spawn = require("child_process").spawn,child;

// child = spawn("powershell.exe",["c:\\temp\\helloworld.ps1"]);
child = spawn("powershell.exe",["C:\\Users\\Admin\\Trackman` `Kiosk\\checkout-one-time-payments\\server\\node\\scripts\\exec_chrome_qr.ps1"]);

child.stdout.on("data",function(data){
    console.log("Powershell Data: " + data);
});
child.stderr.on("data",function(data){
    console.log("Powershell Errors: " + data);
});
child.on("exit",function(){
    console.log("Powershell Script finished");
});
child.stdin.end(); //end input