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
Defines the Axis class
***********************************************************/

/* TODO:
    - Do we need "displayScale"? or some way to show a moving partial
	view of an Axis?
    - Add capability for "patches" of higher density, overlaid on an Axis?
	(probably another Axis with different granularity and the ability
	to translate from one coordinate system to the other)
    - Different shapes (curved, spiral, "weighted" with bumps) should
	be possible in Flash MX, which supports basic mathematical
	drawing and distortion of vectors
    - Allow periodic (vs. linear) axes? or is this the function of a Clock?
	Or is there a 'circular' property?
    - Support changes in granularity, precision "on the fly"? Would require
	remapping all existing children to new scheme, which could be
	hard or impossible...
*/

// constructor function
function Axis( sourceXMLnode ) {
    // Has data been provided? 'sourceXMLDOM' is a live (parsed) XML tree, or text?

    // invoke the constructor of my "ancestor" class, then call it using
    // values (passed in as arguments, or typical for my class)
    this.base = GenericTemporalObject;
    this.base('Axis', sourceXMLnode );

    // Has source-data been provided? If so, 'xmlSourceDOM' is a live (parsed) XML tree
    if (false) { //(sourceXMLnode instanceof XML) {
        // The source XMLDOM checks out, retrieve its attribute values to
        // initialize my properties
        return "ERROR: I don't know how to load XML data yet!";
    } else {
        // No source provided, so this must be a new object; set default values instead

        // define core properties
        this.name = this.ID;
        this.description = "";

        // provide for a weighted "label"
        this.labelIndex = null;		// normally an integer, from 0 to 9
        this.labelStrength = null;	// how strong is this association?

        // TODO: Add a pointer to a possible parent timeline?
///        this.parent = null;
        
        // keep an array of pointers to my children (Events, Instants, others?)
        this.children = new Array();

        // establish basic metrics for this Axis (its units, precision, etc.)
        /*
        this.baseUnit = "chronons";		// could be "seconds", "days", "decades", etc.
            // NOTE that chronons are a fictional unit of time; essentially arbitrary time
        this.precision = 1;		// Our granularity in base units (0.01, 1000, etc.)
        */
        // NO, that's absurd. A Timeline isn't just "days", it's days/weeks/minutes in a calendar system.
        // We should simply declare what metric ("temporal universe") we're operating in, and rely on 
        // snapping or other features to enforce coarser granularity.
        this.metric = "Gregorian calendar";
            // WAS "intrinsic time";	// establishes imaginary units (chronons) in sequence
        
        this.boundedEnds = "both";	// can be "start", "end", "neither", or "both"

        // display characteristics
        this.markedInterval = 10; 	// shows a hash-mark every n baseUnits (or none, if 0)
        this.displayX = 0.5;		// horizontal display position, from 0.0 to 1.0 (left to right)
        this.displayY = 0.5;		// vertical display position, from 0.0 to 1.0 (top to bottom)
        this.displayLength = 0.25;	// length of this axis relative to standard display size
        // define starting and ending times (for display purposes); these can be adjusted manually,
        // or "pushed" by child objects which are outside of these boundaries
        this.startTime = 0;		// are these Javascript Date objects?
        this.endTime = 100000;
        // this.totalDuration = Math.max( 0, endTime - startTime );
    }

    // Now bind to class-specific methods, defined below
    this.getProperty = _axis_getProperty;
    this.setProperty = _axis_setProperty;

    // methods for handling Instants on this Axis
    this.AddInstant = _axis_AddInstant;
/// this.MoveInstant = _axis_MoveInstant;
    this.DeleteInstant = _axis_DeleteInstant;
    
    // methods for handling Events on this Axis
    this.AddEvent = _axis_AddEvent;
/// this.MoveEvent = _axis_MoveEvent;
    this.DeleteEvent = _axis_DeleteEvent;
    
    // methods for handling Intervals on this Axis
    this.AddInterval = _axis_AddInterval;
/// this.MoveInterval = _axis_MoveInterval;
    this.DeleteInterval = _axis_DeleteInterval;

    return this;
}

function _axis_getProperty( strPropName ) {
    // Simply return the value of the specified property
    return this[strPropName];	// returns null if the property doesn't exist
}

function _axis_setProperty(strPropName, suggestedValue) {
    // Attempt to set the specified property, return the new-or-unchanged value;
    // report any errors (bad values, etc.) to standard output

	//baseUnit, precision, markedInterval, startTime, endTime
    if ((strPropName == 'magnitude') || (strPropName == 'displayX') || (strPropName == 'displayY')) {
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

    } else if (strPropName == 'baseUnit') {
		var strSuggestedValue = suggestedValue + "";	// make sure it's a string
		// should be one of our approved base units
        arrAllowedUnits = new Array('seconds', 'days','months', 'years', 'centuries');
		var isAllowed = false;
		// buzz through the list, see if it's there
		for (var i = 0; i < arrAllowedUnits.length; i++) {
		    var testUnit = arrAllowedUnits[i];
		    if (testUnit == strSuggestedValue) {	// found a match!
			isAllowed = true;
		    }
		}
		if (isAllowed) {
		    // it's in the list, so let's allow it
		    this.baseUnit = strSuggestedValue;
		    return this.baseUnit;
		} else {
		    // new value is not in our list, return an error
		    return "ERROR: '" + strSuggestedValue + "' is not an allowed base unit!";
		}

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
            return "ERROR: Name cannot be empty!";
        }
        return this.name;

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

    } else if (strPropName == 'ID') {
		// TODO: This is a read-only property; post an error and return its current value
        return this[ strPropName ];

    } else {	// not an expected property
        return "ERROR: Property '"+ strPropName +"' not found!";
    }
}


function _axis_AddInstant( newChild ) {
    // add it to my 'children' collection; check for constraints or relations? confirm type?
	if (newChild.className != 'Instant') {
		trace( "axis.AddInstant(): ERROR: New child is not an Instant!" );
		return;
	}

	if (this.TestForExistingChild(newChild) == false) {
		// it's a new child; add it to children and set reverse pointer
		this.children.push( newChild );
		newChild.parent = this;
	} else {
		// it's already a child, never mind..
	}

}

function _axis_DeleteInstant( childInstant ) {
	// confirm that this is one of my children
	var testChild = null;
	var foundInstant = false;
	var childCount = this.children.length;
	for (var c = 0; c < childCount; c++) {
		testChild = this.children[c];
		if (testChild == childInstant) {
			// OK, remove this item from my children
			this.children.splice( c, 1 );
			foundInstant = true;
			break;
		}
	}
	if (!foundInstant) {
		// Couldn't find this Instant in my 'children'!
		trace("axis.DeleteInstant(): ERROR, couldn't find the specified Instant");
		return;
	}
	
	// clear the child's 'position' property
	testChild.setProperty( 'position', 0.0 );
	// set its 'parent' to null
	testChild.parent = null;
}



function _axis_AddEvent( newChild ) {
    // add it to my 'children' collection; check for constraints or relations? confirm type?
	if (newChild.className != 'Event') {
		trace( "axis.AddEvent(): ERROR: New child is not an Event!" );
		return;
	}

	if (this.TestForExistingChild(newChild) == false) {
		// it's a new child; add it to children and set reverse pointer
		this.children.push( newChild );
		newChild.parent = this;
	} else {
		// it's already a child, never mind..
	}
}

function _axis_DeleteEvent( childEvent ) {
	// confirm that this is one of my children
	var testChild = null;
	var foundEvent = false;
	var childCount = this.children.length;
	for (var c = 0; c < childCount; c++) {
		testChild = this.children[c];
		if (testChild == childEvent) {
			// OK, remove this item from my children
			this.children.splice( c, 1 );
			foundEvent = true;
			break;
		}
	}
	if (!foundEvent) {
		// Couldn't find this Event in my 'children'!
		trace("axis.DeleteEvent(): ERROR, couldn't find the specified Event");
		return;
	}
	
	// clear the child's 'position' property
	testChild.setProperty( 'position', 0.0 );
	// set its 'parent' to null
	testChild.parent = null;
}


function _axis_AddInterval( newChild ) {
    // add it to my 'children' collection; check for constraints or relations? confirm type?
	if (newChild.className != 'Interval') {
		trace( "axis.AddInterval(): ERROR: New child is not an Interval!" );
		return;
	}

	if (this.TestForExistingChild(newChild) == false) {
		// it's a new child; add it to children and set reverse pointer
		this.children.push( newChild );
		newChild.parent = this;
	} else {
		// it's already a child, never mind..
	}
}

function _axis_DeleteInterval( childInterval ) {
	// confirm that this is one of my children
	var testChild = null;
	var foundInterval = false;
	var childCount = this.children.length;
	for (var c = 0; c < childCount; c++) {
		testChild = this.children[c];
		if (testChild == childInterval) {
			// OK, remove this item from my children
			this.children.splice( c, 1 );
			foundInterval = true;
			break;
		}
	}
	if (!foundInterval) {
		// Couldn't find this Interval in my 'children'!
		trace("axis.DeleteInterval(): ERROR, couldn't find the specified Interval");
		return;
	}
	
	// clear the child's 'position' property
	testChild.setProperty( 'position', 0.0 );
	// set its 'parent' to null
	testChild.parent = null;
}

trace("*** Axis_class loaded successfully ***");
