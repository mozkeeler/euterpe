let events = require("sdk/system/events");
let { Ci, Cc, Cu } = require("chrome");

let { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm", {});
let { FileUtils } = Cu.import("resource://gre/modules/FileUtils.jsm", {});

function TraceListener() {
  this.pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
  this.pipe.init(true, true, 0, 0xffffffff, null);
  let tmpFile = FileUtils.getDir("TmpD", [], false, true);
  tmpFile.append((new Date()).getTime() + ".mp3");
  this.fos = FileUtils.openFileOutputStream(tmpFile, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE);
}

TraceListener.prototype = {
  pipe: null,
  originalChannel: null,
  fos: null,

  onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
    let newData = NetUtil.readInputStreamToString(aInputStream, aCount);
    this.pipe.outputStream.write(newData, aCount);
    this.fos.write(newData, aCount);
    this.originalChannel.onDataAvailable(aRequest, aContext,
                                         this.pipe.inputStream, aOffset,
                                         aCount);
  },

  onStartRequest: function(aRequest, aContext) {
    this.originalChannel.onStartRequest(aRequest, aContext);
  },

  onStopRequest: function(aRequest, aContext, aStatusCode) {
    this.originalChannel.onStopRequest(aRequest, aContext, aStatusCode);
    this.fos.close();
  }
};

function onExamineResponse(aEvent) {
  let channel = aEvent.subject.QueryInterface(Ci.nsIChannel);
  if (channel.contentType == "audio/mpeg") {
    let traceChannel = channel.QueryInterface(Ci.nsITraceableChannel);
    let traceListener = new TraceListener();
    traceListener.originalChannel = traceChannel.setNewListener(traceListener);
  }
}

events.on("http-on-examine-response", onExamineResponse);
