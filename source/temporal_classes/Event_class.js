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
Defines the Event class
***********************************************************/

// here is a constructor function
function Event( sourceXMLnode ) {
    var err = null;			// use this local to keep track of error codes

    // invoke the constructor of my "ancestor" class, then call it using
    // values (passed in as arguments, or typical for my class)
    this.base = GenericTemporalObject;
    this.base('Event', sourceXMLnode);
    
    // Has source-data been provided? If so, 'sourceXMLnode' is a live (parsed) XML tree
    if (false) { //(sourceXMLnode instanceof XML) {
        _root.report("Event_class.js: Yes, my source node is an instance of XML!");
        // The source XMLDOM checks out, retrieve its attribute values to
        // initialize my properties
    } else {
        // No source provided, so this must be a new object; set default values instead
        this.parent = null;		// keep a pointer to my parent Axis (or null)
        this.previousEvent = null;	// keep pointers to next and previous events, if any
        this.nextEvent = null;
            this.magnitude = 0.5;	// subjective "magnitude" of the event, from 0.0 to 1.0 (max)
        this.displayX = 0.5;	// horizontal display position, from 0.0 to 1.0 (left to right)
        this.displayY = 0.5;	// vertical display position, from 0.0 to 1.0 (top to bottom)
        this.name = this.ID;
        this.description = "";

        // provide for a weighted "label"
        this.labelIndex = null;		// normally an integer, from 0 to 9
        this.labelStrength = null;	// how strong is this association?
    }
    
    // Now bind to class-specific methods, defined below
    this.SetProperty = _event_SetProperty;
    this.GetProperty = _event_GetProperty;
    
    this.InsertBeforeEvent = _event_insertBeforeEvent;
    this.InsertAfterEvent= _event_insertAfterEvent;
    
    // Hold pointers to all related inflections
    this.inflections = new Array();
    
    return this;
}

function _event_getProperty( strPropName ) {
    // Simply return the value of the specified property
    return this[strPropName];	// returns null if the property doesn't exist
}

function _event_setProperty(strPropName, suggestedValue) {
    // Attempt to set the specified property, return the new-or-unchanged value;
    // report any errors (bad values, etc.) to standard output
    if ((strPropName == 'position') || (strPropName == 'magnitude') || (strPropName == 'displayX') || (strPropName == 'displayY')) {
        // Convert suggestedValue to a floating point number, compare to 0.0 and 1.0,
        // enforce boundaries if needed, return the new value
	suggestedValue = suggestedValue + 0.0;
	if (suggestedValue < 0.0) {
	    suggestedValue = 0.0;
        } else if (suggestedValue > 1.0) {
	    suggestedValue = 1.0;
        }
	this[ strPropName ] = suggestedValue;
	// TODO: Format this properly, as a decimal number with two places to the right of the dot
        return this[ strPropName ];
    } else if (strPropName == 'description') {
	// clearing the description is OK
        var strSuggestedValue = suggestedValue + "";
	this.description = strSuggestedValue;
	return this.description;
    } else if (strPropName == 'name') {
        var strSuggestedValue = suggestedValue + "";
	if (strSuggestedValue.length > 0) {
	    this.name = strSuggestedValue;
        } else {
            // TODO: Can't make a visible string from this value! report an error
        }
        return this.name;
    } else if ((strPropName == 'ID') || (strPropName == 'nextEvent') || (strPropName == 'previousEvent')) {
	// TODO: This is a read-only property; post an error and return its current value
        return this[ strPropName ];
    } else if (strPropName == 'labelIndex') {
		// make sure it's an integer from 0 to 9, or null
		var isAllowed = false;
		if (suggestedValue == null) {	// remove the currently assigned label
			isAllowed = true;
		} else if ((typeof(suggestedValue) == 'number') &&
					 (suggestedValue >= 0) &&
					 (suggestedValue <= 9)) {
			isAllowed = true;
		}
		if (isAllowed) {
		    this.labelIndex = suggestedValue;
		    return this.labelIndex;
		} else {
		    // new value is not in our list, return an error
		    return "ERROR: '" + suggestedValue + "' is not an allowed value for labelIndex!";
		}

    } else if (strPropName == 'labelStrength') {
		if (suggestedValue == null) {	// remove the currently assigned label-strength
		    this.labelStrength = null;
		    return this.labelStrength;
		} else {
			var strSuggestedValue = suggestedValue + "";	// make sure it's a string
			// should be one of our approved base units
	        var arrAllowedValues = new Array( 'low', 'medium', 'high' );
			var isAllowed = false;
			// buzz through the list, see if it's there
			for (var i = 0; i < arrAllowedValues.length; i++) {
			    var testValue = arrAllowedValues[i];
			    if (testValue == strSuggestedValue) {	// found a match!
					isAllowed = true;
			    }
			}
			if (isAllowed) {
			    // it's in the list, so let's allow it
			    this.labelStrength = strSuggestedValue;
			    return this.labelStrength;
			} else {
			    // new value is not in our list, return an error
			    return "ERROR: '" + strSuggestedValue + "' is not an allowed label strength!";
			}
		}
    } else {	// not an expected property
        return "ERROR: Property not found!";
    }
}


function _event_insertBeforeEvent( objTargetEvent ) {
    // attempt to precede the specified event; return "OK" or "ERROR: ..."
    if (typeof(objTargetEvent) != 'object') {
	return "ERROR: 'objTargetEvent' is not an object. Please specify the event to insert before";
    }
    // check the target's existing previousEvent...
    var objOldPrevious = objTargetEvent.previousEvent;
    if (objOldPrevious == null) {
	// set matching pointers in these two objects
	objTargetEvent.previousEvent = this;
	this.nextEvent = objTargetEvent;
    } else {
	// there's already an event in this place.. make sure everyone
	// has appropriate pointers to reflect the new order
	objOldPrevious.nextEvent = this;
	this.nextEvent = objTargetEvent;
	objTargetEvent.previousEvent = this;
	this.previousEvent = objOldPrevious;
    }
}

function _event_insertAfterEvent( objTargetEvent ) {
    // attempt to succeed the specified event; return "OK" or "ERROR: ..."
    if (typeof(objTargetEvent) != 'object') {
	return "ERROR: 'objTargetEvent' is not an object. Please specify the event to insert after";
    }
    // check the target's existing previousEvent...
    var objOldNext = objTargetEvent.nextEvent;
    if (objOldNext == null) {
	// set matching pointers in these two objects
	objTargetEvent.nextEvent = this;
	this.previousEvent = objTargetEvent;
    } else {
	// there's already an event in this place.. make sure everyone
	// has appropriate pointers to reflect the new order
	objTargetEvent.nextEvent = this;
	this.nextEvent = objOldNext;
	objOldNext.previousEvent = this;
	this.previousEvent = objTargetEvent;
    }
}

trace("Event_class loaded successfully");

