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
Defines the PlaySpaceLayer class

This largely replaces the old TemporalModel class. It
defines a layer (both visual and logical) within the 
Play Space, which holds child objects as well as a set
of core attributes.

***********************************************************/

// constructor function
function PlaySpaceLayer( sourceXMLnode ) {
    _root.report("PlaySpaceLayer(): here's my XML:\n"+ sourceXMLnode.toString());
    var err = null;			// use this local to keep track of error codes

    // invoke the constructor of my "ancestor" class, then call it using
    // values (passed in as arguments, or typical for my class)
    this.base = GenericTemporalObject;
    this.base('PlaySpaceLayer', sourceXMLnode);
    
/*
    // Has source-data been provided? If so, 'xmlSourceDOM' is a live (parsed) XML tree
    var sourceIsValid = this.isValidXMLDOM(xmlSourceDOM);	// returns true or false
    if (sourceIsValid) {
		// The source XMLDOM checks out, retrieve its attribute values to	
		// initialize my properties
		this.name = xmlSourceDOM.attributes.name;
		this.description = xmlSourceDOM.attributes.description;
		return "ERROR: I don't know how to load XML data yet!";
    } else {
*/
    // No source provided, so this must be a new object; set default values instead
    this.name = ("untitled");		// initial name, based on unique ID
    this.description = "";			// (structured?) text description
    this.contents = new Array();	// keep pointers to my Events, Axes, other children
    
    // Now bind to class-specific methods, defined below
    this.SetProperty = _layer_SetProperty;
    this.GetProperty = _layer_GetProperty;

    this.AddObject = _layer_addObject;
    this.RemoveObject= _layer_removeObject;
    
    return this;
}

function _layer_GetProperty( strPropName ) {
    // Simply return the value of the specified property?
    return this[strPropName];	// returns null if the property doesn't exist
}

function _layer_SetProperty(strPropName, suggestedValue) {
    // Attempt to set the specified property, return the new-or-unchanged value;
    // report any errors (bad values, etc.) to standard output
    if ((strPropName == 'magnitude') || (strPropName == 'displayX') || (strPropName == 'displayY')) {
        // TODO: Convert suggestedValue to an integer, compare to 0.0 and 1.0,
        // enforce boundaries if needed, return the new value
        return this[ strPropName ];
    } else if (strPropName == 'description') {
	// clearing the description is OK
        var strSuggestedValue = suggestedValue + "";
	this.description = strSuggestedValue;
	return this.description;
    } else if (strPropName == 'name') {
	// should be at least one character..
        var strSuggestedValue = suggestedValue + "";
	if (strSuggestedValue.length > 0) {
	    this[strPropName] = strSuggestedValue;
        } else {
            // TODO: Can't make a visible string from this value! report an error
        }
        return this.name;
    } else if ((strPropName == 'Axes') || (strPropName == 'Events') || (strPropName == '')) {
	// TODO: This is a read-only property; post an error and return its current value
        return this[ strPropName ];
    } else {	// not an expected property
        return "ERROR: Property not found!";
    }
}


function _layer_addObject( objTarget) {
	// attempt to add the specified object (Event, Axis, whatever); return "OK" or "ERROR: ..."
	if (typeof(objTarget) != 'object') {
		return "ERROR: First argument is not an object. Please specify the object to add";
	}

	// make sure this isn't already one of my Events
	for (var i in this.contents) {      // iterator
		var testObject = this.contents[i];
		if (testObject == objTarget) {
			return "ERROR: This object is already one of my children!";
		}
	}

	// TODO: Divorce the object from its current PSLayer? Move its sprite?

	// set matching pointers in these two objects
	this.contents.push( objTarget );
	objTarget.layer = this;

	return "OK";
}


function _layer_removeObject( objTarget ) {
    // attempt to remove the specified event; return "OK" or "ERROR: ..."

    // TODO: Remove this method? Perhaps this should be an implicit
    // operation during AddObject (since *someone* had better be taking
    // over this object! Still, may be useful for deleting objects..
    
    if (typeof(objTarget) != 'object') {
		return "ERROR: First argument is not an object. Please specify the event to remove";
    }

	// make sure this is already one of my events
    var foundIt = false;
	for (var i in this.contents) {      // iterator
		var testObject = this.contents[i];
		if (testObject == objTarget) {
			// found it! remove it from the array
            foundIt = true;
			this.contents.splice( i, 1);
		}
	}

	// clear the layer pointer in this object 
    if (foundIt) objTarget.layer = null;

    return "OK";
}

trace("PlaySpaceLayer_class loaded successfully");

