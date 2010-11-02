/*
   Copyright 2010 by the Rector and Visitors of the University of Virginia

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

/***********************************************************
Generic temporal-object class, with supporting methods common
to all temporal objects
***********************************************************/


// Constructor for the generic "base class"; use to establish
//	properties and methods shared by all temporal classes
function GenericTemporalObject( strClassName, xmlSourceNode ) {

	// Bind to generic methods (defined below)
	this.GetUniqueID = _generic_getUniqueID;	// generate a unique (temporary) ID
	this.Clone = _generic_clone;				// duplicate this object, return the duplicate
	this.GetXML = _generic_getXML;			// return this object's data as XML text
	this.GetXMLDOM = _generic_getXMLDOM;		// return this object's data as a "live" XML-DOM
	this.ReportProperties = _generic_reportProperties;	// dump them to output
	this.TestForExistingChild = _generic_testForExistingChild;	// T if specified child found

	// Bind to private methods (should only be called internally)

	// _register( ) and _unregister( ) methods are used to add this object to
	// (or delete it from) a global associative array 'arrTemporalObjectsByID'
	this._register = _generic_register;
	this._unregister = _generic_unregister;

	// Initialize generic properties
	this.className = strClassName;	// eg. "Axis", "Interval"
    _root.report("GenericTO(): Here's my XML node:\n"+ xmlSourceNode.toString());
    
    /* Thawed objects will be linked to their layers once all imported
     * objects have been re-created; new objects will be automatically
     * assigned to the currently selected PlaySpaceLayer.
     */
    this.layer = null;
    
    if (typeof(xmlSourceNode.nodeName) == 'string') {   // it's a valid XML node
        this.ID = xmlSourceNode.attributes.ID;
        this.xmlSourceNode = xmlSourceNode; 
            // we'll store this for use during restoration, then discard
        /* TODO: Set a 'dirty' flag here, to indicate that I have unresolved
         * links? Or just rely on the presence of the source XML? How will I
         * know when all links are definitely resolved, anyway?
         */
    } else {
        this.ID = this.GetUniqueID( );
        this.xmlSourceNode = null;
    }
    
    this._register( );

	return this;
}

function _generic_clone( ) {
	// Create a new object, then populate it with all of my properties
	// (in JavaScript, this will also copy methods); assign a new, unique ID?
	var objClone = new Object( );
	for (aProp in this) {
		var propValue = this[aProp];
		objClone[aProp] = propValue;
	}
	// return the duplicate object to the caller
	return objClone;
}

function _generic_getXML( ) {
	// return XML text for this object
}

function _generic_getXMLDOM( ) {
	// return a live XMLDOM for this object
}

function _generic_getUniqueID( ) {
	// If we weren't given an ID to begin with, fetch a new
	// one now, using the global counter intTemporaryID
	if (typeof(intTemporaryID) == 'undefined') {	// counter doesn't exist yet, start it now
		intTemporaryID = 0;
	}
	// increment the counter and take its new value for my ID
	intTemporaryID ++;
	var myNewID = this.className + "_" + intTemporaryID;	// eg. "Event_12"
	// return this number to the caller (probably my more specific class script)
	return myNewID;
}

function _generic_register( ) {
	// if there's no global array, create it now
	if (typeof(objTemporalObjectRegistry) == 'undefined') {
		trace( "creating registry object!" );
		objTemporalObjectRegistry = new Object( );
	} else {
	}
	// TODO: Check for duplicate IDs in the Registry, and warn if found!
	// add this object to it (or replace an object with a duplicate ID!?), using its ID
	objTemporalObjectRegistry[ this.ID ] = this;
}

function _generic_unregister( ) {
	// if the registry exists, remove me from it (clear any object keyed to my ID)
	if (typeof(objTemporalObjectRegistry) == 'object') {
		objTemporalObjectRegistry[ myID ] = null;
	}
}

function _generic_isValidXMLDOM( xmlTestDOM ) {
	// return true if it's a real DOM, false if it's not
	var isValid = false;
	if (typeof(xmlTestDOM) == 'object') {
		if (xmlTestDOM.firstChild != null) {
			// OK, it looks legit
			isValid = true;
		}
	}
	// return the result of our tests
	return isValid;
}

function _generic_reportProperties( ) {
	// print the basic properties of this object to an appropriate local
	// output stream (eg. Flash's Output window, JS alert statements)
	var strOutput = "Report of "+ this.className + " '" + this.ID + "': \n";
	for (var aProp in this) {
		var itsValue = this[aProp];
		if (typeof( itsValue ) != 'function') {
			strOutput += ("  "+ aProp +" = "+ itsValue +" <" + typeof(itsValue) + ">\n");
		}
	}
	strOutput += "\n";
	// For now, just dump this to Flash's Output window
	trace( strOutput );
}

function _generic_testForExistingChild( objCandidate ) {
	// IF I have a 'children' collection, search it for the
	// specified candidate; return true if found, false otherwise
	if (this.children == null) {
		return false;	// no 'children' array, so not found
	} else {
		var testChild = null;
		var childCount = this.children.length;
		for (var c = 0; c < childCount; c++) {
			testChild = this.children[c];
			if (testChild == objCandidate) {
				// found it!
				return true;
			}
		}
		// nope, it's not among my children
		return false;
	}
}

trace("GenericTemporalObject_class loaded successfully");
