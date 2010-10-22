/*
XML-RPC Flash Lib V 1.02
------------------------------------
Modified by Jim Allman (jim@ibang.com) to provide more status information to callback (find 'jimA' for changes)

Created By: Pedro Ornelas (killer@netmadeira.com)

Based on: Dave Winer's XML-RPC Specification

Tested with: Flash MX
			 Edd Dumbill's XML-RPC lib for PHP 1.02

New changes: -The ASSetPropFlag was missing, now it's there.

#V1.0.1# -A small bug was fixed, the object couldn't be reused after the first request
		 -ASSetPropFlag was added to the beggining, so that an array.prototype property doesn't interfere with the for..in loops
		 -The automatic escaping and unescaping of strings was removed

History: -(04/02/2002) The lib was completed and released

 ## LICENCE ##
 You may use this library for individual and commercial purposes free of charge, 
 but you must keep this header in your source files.
 A reference to this library and the author would be nice. :)
 ## END OF LICENSE ## 
*/

/*Made some modifications to the array object so i can know it's an array*/
array.prototype.isArray = true;

/* jimA: Modify the XML object, so we can keep track of its raw source in case it doesn't parse */
XML.prototype.normalOnData = XML.prototype.onData;
XML.prototype.onData = function( source ) {
	this.rawSource = source;
	_root.report("XML: my raw source is:\n"+ source);
	this.normalOnData( source );
}
_root.report("normalOnData is a "+ typeof(XML.prototype.normalOndata));
_root.report("onData is a "+ typeof(XML.prototype.ondata));

/*String Trim function*/
/*If you have better(i mean faster) trim functions, please send them to me so I can include them in the library*/
String.prototype.ltrim = function(){
	var size = this.length;
	for(i = 0; i < size; i++){
		if(this.charCodeAt(i) > 32) return this.substring(i);
	}return "";
};
String.prototype.rtrim = function() {
	var size = this.length;
	for(i = size; i >= 0; i--){
		if(this.charCodeAt(i) > 32) return this.substring(0, i + 1);
	}return "";
};
String.prototype.trim = function(){
 var s = this.rtrim();
 return s.ltrim();
};

//used to prevent isArray from appearing in for..in loops
ASSetPropFlags(Array.prototype,"isArray",1);

/*Public Methods*/

/* xmlrpc Method(Constructor)*/
xmlrpc = function(path_to_script) {
	this.path = path_to_script;
	this.error = {code:0,args: {}};
	this.AUTO_FORMAT = false;
	this.rxml = new XML();
	this.mxml = new XML();
};
/*The main function, sends and receives the XML data*/
xmlrpc.prototype.send = function(strMethodName,arParams) {
	var methodCall,methodName,params,i,param;
	
	this.mxml.contentType = "text/xml";
	this.mxml.xmlDecl = "<?xml version=\"1.0\"?>";
	methodCall = this.mxml.createElement("methodCall");
	methodName = this.mxml.createElement("methodName");
	//methodName.appendChild(this.mxml.createTextNode(escape(strMethodName)));
	methodName.appendChild(this.mxml.createTextNode(strMethodName));
	methodCall.appendChild(methodName);
	if (arParams != null) {
		params = this.mxml.createElement("params");
		for (i=0;i<arParams.length;i++) {
			param = this.mxml.createElement("param");
			param.appendChild(this.getXMLParameter(arParams[i]));
			params.appendChild(param);
		}
		methodCall.appendChild(params);
	}
	this.mxml.appendChild(methodCall);
	this.rxml.ref = this;
	this.rxml.onLoad = this.onLoadXML;
	this.mxml.ignoreWhite=true;
	this.rxml.ignoreWhite=true;

	this.mxml.contentType = "text/xml";	// jimA: REINFORCE THIS!?
	_root.report( "Outgoing contentType is '"+ this.mxml.contentType +"'" );
	this.mxml.sendAndLoad(this.path,this.rxml);
	_root.report( "Sending this RPC request:\n" + this.mxml.toString() );		// jimA
};
/*Will send an array of parameters*/
xmlrpc.prototype.getParameters = function(obj) {
	var arr,i;
	arr=[];
	for(i=0;i<obj.length;i++) {
		arr.push(this.getFormated(obj[i]));
	}
	return arr;
};

/*addParameter - returns a formated parameter to be inserted in the array for sending*/
xmlrpc.prototype.setParameter = function(value,ptype) {
	var kind,tmp,i,key;
	if(!ptype) {
		/*Start auto-type mode, it will make a recursive search through arrays and objects*/
		if((kind = this.kindOf(value))== "array") {
			tmp={dtype: "array",values: []};
			for(i=0;i<value.length;i++) {
				if (value[i].dtype == null) {
					tmp.values.push(this.setParameter(value[i]));
				}else {
					tmp.values.push(value[i]);
				}
			}
			return tmp;
		}else if (kind == "struct") {
			tmp={dtype: "struct",values: []};
			i=0;
			for(key in value) {
				if (value[key].dtype == null) {
					tmp.values.push(this.setParameter(value[key]));
					tmp.values[i].name = key;
				}else {
					tmp.values.push(value[key]);
				}
				i++;
			}
			return tmp;
		}else if((kind == "int") or (kind == "string") or (kind == "boolean") or (kind == "double") or (kind == "base64") or (kind == "dateTime")){
			return {dtype: kind,values: value};
		}
	}else {
		if (ptype == "array") {
			for(i=0;i<value.length;i++) {
				if (value[i].dtype == null) {
					tmp.values.push(this.setParameter(value[i]));
				}else {
					tmp.values.push(value[i]);
				}
			}
		}else if (ptype == "struct") {
			tmp={dtype: "struct",values: []};
			i=0;
			for(key in value) {
				if (value[key].dtype == null) {
					tmp.values.push(this.setParameter(value[key]));
					tmp.values[i].name = key;
				}else {
					tmp.values.push(value[key]);
				}
				i++;
			}
			return tmp;
		}else if((ptype == "int") or (ptype == "string") or (ptype == "boolean") or (ptype == "double") or (ptype == "base64") or (ptype == "dateTime")){
			return {dtype: ptype,values: value};
		}
	}
};

/*Private Methods*/

/*This function will handle the response message arrival*/
xmlrpc.prototype.onLoadXML = function(success) {
	//_root.textxml = this.toString();		// jimA
	var tmp;
	if(success) {
		if (this.status == 0) {
			if ((this.childNodes.length == 1) && (this.childNodes[0].nodeName == "methodResponse")) {
				tmp = this.childNodes[0];
				if ((tmp.childNodes.length ==1) && ((tmp.childNodes[0].nodeName == "fault") || (tmp.childNodes[0].nodeName == "params"))) {
					if (tmp.childNodes[0].nodeName == "fault") this.ref.parseFault(tmp.childNodes[0]);
					else {
						this.ref.parseResponse(tmp.childNodes[0]);
					}
				}else this.ref.callError(-2, "Incomplete response, no <fault> or <params> returned");	// jimA
			}else this.ref.callError(-2, "Missing <methodResponse> node");	// jimA
		}else this.ref.callError(-3,this.status +':'+ this.rawSource);
	}else this.ref.callError(-4);
	this.ref.reset();
	this.ref=null;
};
//will reset the object properties so that it can be used again
xmlrpc.prototype.reset = function() {
	this.error = {code:0,args: {}};
	this.rxml = new XML();
	this.mxml = new XML();
}
/*Parses de Fault structure and generates an error msg*/
xmlrpc.prototype.parseFault = function(obj) {
	var ftCode,ftString,i;
	/*Parse the Fault values and call an Error*/
	if (obj.childNodes[0].nodeName == "value") {
		obj = this.parseValues(obj.childNodes[0]);
		if (obj.dtype == "struct") {
			for(i=0;i<obj.values.length;i++) {
				if (obj.values[i].name == "faultCode") {
					ftCode = obj.values[i].values;
				}else if(obj.values[i].name == "faultString") {
					ftString = obj.values[i].values;
				}
			}
			this.callError(-1,{faultCode: ftCode, faultString: ftString});
		}else this.callError(-2, "Incomplete fault, missing struct");	// jimA
	}else this.callError(-2, "Incomplete fault, missing <value> node");	// jimA
};
/*parseResponse - parses the response values and formats it correctly*/
xmlrpc.prototype.parseResponse = function(obj) {
	var paramN,arParams;
	arParams = [];
	if (obj.childNodes.length > 0) {
		/*Will loop every <param> and add it to the arParams array*/
		for (paramN=0;paramN<obj.childNodes.length;paramN++) {
			arParams.push(this.parseValues(obj.childNodes[paramN].childNodes[0]));
		}
		/*Make the response available to the user*/
		if (this.AUTO_FORMAT) this.callBack(0,this.getParameters(arParams));
		else this.callBack(0,arParams);
	}else this.callError(-2, "Incomplete response, no child nodes");	// jimA
};
/*parseValues - This function receives a <value> and returns it in a formated and explicit way*/
xmlrpc.prototype.parseValues = function(obj) {
	var kind,value,name;
	if (obj.nodeName == "value") {
		obj = obj.childNodes[0];
		if (obj.nodeType == 3) {
			return {dtype: "string",values: obj.nodeValue};
		}else{
			name = obj.nodeName;
			if ((name == "string") or (name == "double") or (name == "base64")) {
				//return {dtype: name,values: unescape(obj.childNodes[0].nodeValue.trim())};
				return {dtype: name,values: obj.childNodes[0].nodeValue.trim()};
			}else if (name == "boolean") {
				var r = obj.childNodes[0].nodeValue.trim();
				return {dtype: name,values: (r==1)?(true):(false)};
			}else if ((name == "int") or (name == "i4")) return {dtype: "int",values: obj.childNodes[0].nodeValue.trim()};
			else if(name == "dateTime.iso8601") return {dtype: "dateTime",values: obj.childNodes[0].nodeValue.trim()};
			else if(name == "array") {/*Array Processing*/
				var i,nodData,arArray;
				arArray=[];
				obj=obj.childNodes;
				if(obj[0].nodeName == "data") {
					nodData = obj[0];
					for (i=0;i<nodData.childNodes.length;i++) {
						if(nodData.childNodes[i].nodeName == "value") {
							arArray.push(this.parseValues(nodData.childNodes[i]));
						}
					}
					return {dtype: "array",values: arArray};
				}else this.callError(-2, "Incomplete array, missing <data> node" );	// jimA
			}else if (name == "struct") {
				var i,nodMember,j,structName,structValue,structArray; 
				structArray = [];
				obj=obj.childNodes;
				for(i=0;i<obj.length;i++) {
					if (obj[i].nodeName == "member") {
						nodMember = obj[i];
						for(j=0;j<nodMember.childNodes.length;j++) {
							if(nodMember.childNodes[j].nodeName == "name") {
								structName = nodMember.childNodes[j].childNodes[0].nodeValue;
							}else if (nodMember.childNodes[j].nodeName == "value") {
								structValue = this.parseValues(nodMember.childNodes[j]);
							}
						}
						if (structValue != null) {
							structValue.name = structName;
							structArray.push(structValue);
						}else this.callError(-2, "Incomplete struct");	// jimA
					}
				}
				return {dtype: "struct",values: structArray};
			}else this.callError(-2, "Unknown data type <"+ name +">");	// jimA
		}
	}else this.callError(-2, "Expecting <value>, not <"+ obj.nodeName +">");	// jimA
};
/*getFormated - This function will return a value that is ready-to-use in the resto of the app*/
/*This value can be scalar, an array or an object*/
xmlrpc.prototype.getFormated = function(obj) {
	var kind,value,i;
	kind = obj.dtype;
	if (kind=="array") {
		value = [];
		for (i=0;i<obj.values.length;i++) {
			value.push(this.getFormated(obj.values[i]));
		}
		return value;
	}else if(kind=="struct") {
		value = {};
		for (i=0;i<obj.values.length;i++) {
			value[obj.values[i].name] = this.getFormated(obj.values[i]);
		}
		return value;
	}else {
		return obj.values;
	}
};
/*Used to send back an error msg*/
xmlrpc.prototype.callError = function(erNumber,erArgs){
	this.callBack(erNumber,erArgs);
};
/*getXMLParameter - this function is used to return the formated XML param node*/
xmlrpc.prototype.getXMLParameter = function(val) {
	var value;
	value = this.mxml.createElement("value");
	if (val.dtype == "array") {
		var nodArray,nodData,i;
		nodArray = this.mxml.createElement("array");
		nodData = this.mxml.createElement("data");
		for(i=0;i<val.values.length;i++) {
			nodData.appendChild(this.getXMLParameter(val.values[i]));
		}
		nodArray.appendChild(nodData);
		value.appendChild(nodArray);
	}else if (val.dtype == "struct") {
		var nodStruct,nodMember,nodName,i;
		nodStruct = this.mxml.createElement("struct");
		for(i=0;i<val.values.length;i++) {
			nodMember = this.mxml.createElement("member");
			nodName = this.mxml.createElement("name");
			nodName.appendChild(this.mxml.createTextNode(val.values[i].name));
			nodMember.appendChild(nodName);
			nodMember.appendChild(this.getXMLParameter(val.values[i]));
			nodStruct.appendChild(nodMember);
		}
		value.appendChild(nodStruct);
	}else {
		val.dtype = (val.dtype == "dateTime")?("dateTime.iso8601"):(val.dtype);
		if (val.dtype == "boolean") val.values = (val.values)?(1):(0)
		var datatype;
		datatype = this.mxml.createElement(val.dtype);
		//datatype.appendChild(this.mxml.createTextNode(escape(val.values)));
		datatype.appendChild(this.mxml.createTextNode(val.values));
		value.appendChild(datatype);
	}return value;
};
/*kindOf - used in auto detecting the data types*/
xmlrpc.prototype.kindOf = function(obj){
	if (obj.isArray) {
		return "array";
	}else {
		switch(typeof(obj)) {
			case 'string': return 'string';break;
			case 'number': 
				if (obj.toString().indexOf(".") == -1) return 'int';
				else return 'double';
				break;
			case 'boolean': return 'boolean';break;
			case 'object': return 'struct';break;
			default: return false;
		}
	}
};
