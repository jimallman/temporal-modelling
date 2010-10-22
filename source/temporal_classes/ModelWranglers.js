/***********************************************************
 *
 * $Author: jima $
 *
 * $Date: 2004/02/11 02:29:24 $
 *
 * $Revision: 1.17 $
 *
 * $Log: ModelWranglers.js,v $
 * Revision 1.17  2004/02/11 02:29:24  jima
 * Added Cancelled inflection
 *
 * Revision 1.16  2004/02/10 19:15:21  jima
 * Added Causality sprite, moving on to Inspector...
 *
 * Revision 1.15  2004/02/05 21:44:18  jima
 * We have working Special inflections, now I'll work on Causality.
 *
 * Revision 1.14  2004/02/04 20:04:11  jima
 * Currently in rough shape. I'm going to tighten up layer vs. parent distinction, finish freeze/thaw logic
 *
 * Revision 1.13  2004/01/31 08:32:01  jima
 * ...more progress, saving OK i think, but won't load properly...
 *
 * Revision 1.12  2004/01/31 07:44:59  jima
 * still debugging selective freeze..
 *
 * Revision 1.11  2004/01/31 06:10:53  jima
 * Fixed mismatched {
 *
 * Revision 1.10  2004/01/31 06:04:42  jima
 * Selective freeze and thaw functions are done(?), ready for testing..
 *
 * Revision 1.9  2004/01/31 05:11:22  jima
 * Working out thawTemporalModel(), including layer consolidation option
 *
 * Revision 1.8  2004/01/30 20:41:54  jima
 * Moving to more selective model-wrangling, based on selected objects rather
 * than just layers. freezeTemporalModel() is ready to test, now I'll do
 * restoreFromTemporalModel()
 *
 * Revision 1.7  2004/01/30 15:59:56  jima
 * Save BEFORE attempting unified methods for load/save and clipboard
 * functions
 *
 * Revision 1.6  2004/01/29 16:48:10  jima
 * Added fairly strong UUID generator, to avoid ID collisions in loaded models
 *
 * Revision 1.5  2004/01/28 05:13:46  jima
 * Inflections are now full-fledged objects, vs. relations (and stored
 * accordingly)
 *
 * Revision 1.4  2004/01/27 16:56:47  jima
 * Removed 'Source' keyword (not required)
 *
 * Revision 1.3  2004/01/27 15:58:03  jima
 * Added keyword expansion, perhaps a standard file header
 *
 *
 ***********************************************************/

/*
Functions for loading and saving (marshalling, freezing 
and thawing) data for "temporal models"

A temporal model is a strictly transitive object, not a 
persistent temporal primitive that can be tinkered with. 
In fact, it's more of a transport container, a bundle of 
stored stuff: Play Space settings, layer specs, color
settings, temporal objects and temporal relations. (See 
the sample XML for details).

For this reason, we should only wrangle temporal models
in the Play Space when it's time to wrap or unwrap data.
Once XML data's been un-wrapped, it's dumped into the free-
for-all environment of the Play Space. When the user decides
to "save a model", we create a temporal model by capturing
all the requested layers, their objects, and any selected 
Play Space settings into an XML string for storage.

SO... there really isn't any need for a TemporalModel class,
just a set of methods for wrapping and un-wrapping this data
(from XML to live objects and back).

TODO: Determine whether a newly loading model should assert
its own labels on other objects in the PS, or simply strip
their current labels.

TODO: Apply some scheme to reconcile object IDs in multiple 
models? Conflicting names, too? Or should we simply treat all
IDs as temporary/local?

Here's a thought experiment: What happens if we load the model "Battle of the
Bulge" into the Play Space, then load it again? I think there
should be two (duplicate) sets of data, but with different IDs
and layers
    

TODO: Outline class-names and define classes for some inflection types:
    Special
        .sprite => mc, .target => obj
        targetID=
    Causality
        .sprite => mc, .source => obj, .targetObj => obj
        sourceID=, targetID=
    EncompassingMood:
        .sprite => mc, .includedObjects => [obj, obj, ...]
        includedIDs= {comma-delimited ID values}


***********************************************************/


function generateUUID( className ) {
	// Generate a universally unique ID. This should include the specified
	// class-name, if one was provided. Here we try to follow the principles
	// for a solid UUID/GUID: a theoretically unique stamp based on spatial,
	// temporal, and randomized elements.

	// NOTE that, while hex would make this ID shorter, we only use it 
	// for the IP address, since other numbers are usually too long for 
	// Actionscript to render as hex (go figure..)
	var strUUID = "";
	if (typeof(className) == 'string') {
		// Prepend with class-name, if provided. Note that this is largely
		// for legibility in model XML, so we can see what kinds of objects
		// are linked within a model.
		strUUID += (className +":");
	}

	// Add a large random number (in case of rapid-fire generation of UUIDs)
	var bigRandomNumber = String(Math.random()).substr(2);
	strUUID += bigRandomNumber;

	// Add a token for location (IP address), in hex
    // NOTE that we've already loaded the client's presumed IP address
    // in the root Flash timeline, as 'currentIPAddress'
	strUUID += ":";
	var strOctet, IParray = currentIPAddress.split('.');
	for (var i = 0; i < 4; i++) {
		strOctet = Number(IParray[i]).toString(16);
		if (strOctet.length == 1) {
			// pad single digit numbers
			strOctet = "0"+ strOctet;
		}
		strUUID += strOctet;
	}

	// Add a "safety" token for elapsed time (milliseconds since this Flash
	// movie started playing)
	var timeComponent1 = getTimer();
	strUUID += (":"+ timeComponent1);

	// Add a token for current timestamp (UTC millisec from Date)
	var tempDate = new Date();
	var timeComponent2 = tempDate.getTime();
	delete tempDate;
	strUUID += (":"+ timeComponent2);

	return strUUID;
}


// Restore selected layers from a temporal-model XMLDOM (create and populate
// the specified objects in the Play Space), then return a simple result code
// ("OK" or an error string)
function thawTemporalModel( modelNode, arrIncludedLayerNodes, blnApplyPSlabels, blnApplyPSlayout, blnConsolidateLayers ) {
	// 'arrLayerNodes' is an array of <Layer> nodes (presumably from a single parent 
	// <TemporalModel>) whose data we've chosen to thaw. NOTE: An empty array is OK, maybe 
	// we just want the Play Space labels..
	if (arrIncludedLayerNodes.length == 0) {
		if ((!blnApplyPSlabels) && (!blnApplyPSlayout)) {
			// Weird, they're not actually asking for anything from this model.. bail out!
			_root.report( "No layers specified, no labels or layout.. What's the point?" );
			return "No layers specified, no labels or layout.. What's the point?";
		}
	} else if ((arrIncludedLayerNodes instanceof Array) == false) {
		_root.report( "thawTemporalModel(): ERROR - second arg is not an Array!" );
		return "Second arg is not an Array (of Layer nodes)!";
	}

	// If 'blnApplyPSlabels' is true, then this model should assert its
	// stored label settings in the Play Space (convert existing objects?!)

	// If 'blnApplyPSlayout' is true, then the thawed objects should assume
	// their previous scale and position in the Play Space. Otherwise, general
	// layout rules should determine their placement.

    // If 'blnConsolidateLayers' is true, then we should look for
    // same-named layers in the Play Space, and place our restored objects
    // in the matching layer, if avaialble.    

	// First, let's apply any Play Space settings that were chosen
    // NOTE: As a rule, we shouldn't expect this when pasting from the
    // clipboard, but only when loading a stored model.
	if (blnApplyPSlabels) {
		// TODO: Use these settings in the current Play Space (assert
		// in the current PS objects, or clear their labels?)
		_root.report( "I'll restore its labels!" );

		// Restore these Play Space settings from the input XML
		// NOTE: This is a comma-delimited list of escape'd label names, with 
		// empty entries for untitled labels, for example:
		// "critical%20days,major%20causes,disruptive%20forces,,,major%20surprises,,,,"
		var labelsNode = _root.XMLSupportLib.selectSingleNode( modelNode, 'PlaySpaceSettings' );
		var arrSafeLabels = labelsNode.attributes.labels.split(',');
		var n, labelName;
		for (n = 0; n < arrSafeLabels.length; n++) {
			// Restore the name of each label to the Play Space (if any, or "")
			var labelName = unescape( arrSafeLabels[n] );		// Restore non-URL-safe characters
			if (labelName.length == 0) {
				// The Play Space uses null if no proper name
				_root.labels[n] = null;
			} else {
				_root.labels[n] = labelName;
			}
		}
	}

	if (blnApplyPSlayout) {
		// TODO: Define what exactly we're capturing here, and how to restore it..
		_root.report( "Now I'd restore its Play Space layout!" );
	}

    // Groom the incoming XML, to weed out all unused layers and objects,
    // and assign unique Play Space IDs to all nodes
    modelNode = groomIncomingModelXML( modelNode, arrIncludedLayerNodes, blnConsolidateLayers );
    
	// OK, now find and step through all the listed layers; merge or rename
	// them as needed, create all their child objects and relations, place
	// them in the Play Space based on stored layout *or* general rules
	var i, aLayerNode, layerID, objLayer, itsID;
	var arrIncludedObjectIDs = new Array();
		// We'll keep track of the IDs of all objects in these layers, so 
		// that we can quickly load their relations

	for (i = 0; i < arrIncludedLayerNodes.length; i++) {
		aLayerNode = arrIncludedLayerNodes[i];
		if (aLayerNode.nodeName != 'Layer') {
			_root.report( "thawTemporalModel(): ERROR - missing or invalid Layer node!" );
			return "ERROR - missing or invalid Layer node!";
		} else {
			var currentLayerID = aLayerNode.attributes.ID;
			_root.report( "Analyzing layer '"+ aLayerNode.attributes.name +"' ("+ currentLayerID +")..." );
			// Reincarnate this layer into the Play Space, and grab a pointer to the new Layer object
			objLayer = _root.newLayer( aLayerNode );
			
			// TODO: Consolidate all this XML-to-visible-sprite stuff in a consistent manner!
			
			// Set the literal Flash coordinates etc in the Layer's sprites. NOTE that here
			// we support a stack of Flash sprite instances, e.g. objLayer.sprites[ 'points' ]._x
			var aSpriteName, aSpriteInstance;
			for (aSpriteName in objLayer.sprites) {	
				// Read names from a keyed list, then retrieve each instance to set its props
				aSpriteInstance = objLayer.sprites[ aSpriteName ];
				aSpriteInstance._x = aLayerNode.attributes.spriteX;
				aSpriteInstance._y = aLayerNode.attributes.spriteY;
				aSpriteInstance._xscale = aLayerNode.attributes.spriteXscale;
				aSpriteInstance._yscale = aLayerNode.attributes.spriteYscale;
				aSpriteInstance._alpha = aLayerNode.attributes.spriteAlpha;
			}
		}

		// TODO: List any temporal objects belonging to this layer, and thaw 
		// them into live objects
		// - If *not* applying stored labels, remove all label settings
		// - If *not* applying stored layout, place according to general rules
		// - Add its ID (as stated in the source XML) to arrIncludedObjectIDs
		var objectCollectionNode = _root.XMLSupportLib.selectSingleNode( modelNode, 'TemporalObjects' );
        _root.report("@ found object collection: <"+ objectCollectionNode.nodeName +">");
		var objectNode = objectCollectionNode.firstChild;
		while (objectNode != null) {
			if (objectNode.attributes.layerID == currentLayerID) {
				_root.report( "Now I'll restore this <"+ objectNode.nodeName +">..." );
				// Yes, this object belongs to the included layer
				_root.restoreObjectIntoWorkspace( objectNode );
			}
			// step to the next object node (if any) and continue
			objectNode = objectNode.nextSibling;
		}

///		itsID = blah;	//TODO
///		arrIncludedObjectIDs.push( itsID );
		// NOTE that these objects may have relationships with others in the 
		// saved model, and there's no way to tell which order they'll load in
		//
		// TODO: Come up with a way of creating all, then linking as appropriate?
		// Perhaps we create all of them, stash in the global object registry,
		// and (optionally) create a Flash sprite for each.. THEN we keep buzzing
		// through an 'orphans' list (of objects from this model), assigning children
		// to parents until everyone's found a home (even if it's just "floating"
		// within a parent layer).		
	}
	
	// Now let's re-unite any objects to their parents (if restored). NOTE that some
	// objects simply float within a Layer; these have been replaced in the proper
	// layer, so we're only interested in objects whose parents are something else
	// (eg. Timelines)
	//
	// We'll simply buzz through the global registry of Temporal Objects and look for
	// anything with a special-purpose 'storedParentID' attribute. If found, this should
	// be used to re-unite the object to its parent, then it should be deleted.
///	_root.report( "Now let's re-unite orphaned objects with their parents..." );
	var childID, testChild, itsStoredParentID;
	var testID, testParent;
	for (childID in _root.objTemporalObjectRegistry) {
		testChild = _root.objTemporalObjectRegistry[childID];
        // look for a stored parent ID (found only in newly-imported
        // objects)...
		var itsStoredParentID = testChild.xmlSourceNode.attributes.parentID;
        // same treatment for stored layer ID, if any
		var itsStoredLayerID = testChild.xmlSourceNode.attributes.layerID;
        // ...and look for other IDs that link inflections to primitives
        var itsStoredSourceID = testChild.xmlSourceNode.attributes.sourceID;
        var itsStoredTargetID = testChild.xmlSourceNode.attributes.targetID;
        var testObject;
        
        _root.report( "Checking object '"+ childID +"' for stored links..." );

		if ((typeof(itsStoredParentID) == 'string') ||
            (typeof(itsStoredLayerID)  == 'string') ||
            (typeof(itsStoredSourceID) == 'string') ||
            (typeof(itsStoredTargetID) == 'string')){
            
			// This object has one or more stored links! Let's find and restore them
            if (typeof(itsStoredParentID) == 'string') {
                _root.report( "Yes, '"+ childID +"' has a stored parentID '"+ itsStoredParentID +"'" );
                // try to find its stored parent
                for (testID in _root.objTemporalObjectRegistry) {
                    testObject = _root.objTemporalObjectRegistry[testID];
                    if (testObject.ID == itsStoredParentID) {
                        testObject.children.push( testChild );
                        testChild.parent = testObject;
                        break;  // that's it..
                    }
                }
            }
            
            if (typeof(itsStoredLayerID) == 'string') {
                _root.report( "Yes, '"+ childID +"' has a stored layerID '"+ itsStoredLayerID +"'" );
                // try to find its stored Layer
                for (testID in _root.objTemporalObjectRegistry) {
                    testObject = _root.objTemporalObjectRegistry[testID];
                    if (testObject.ID == itsStoredLayerID) {
                        // This time, we use a standard method
                        testObject.AddObject( testChild );
                    }
                }
            }
           
            if (typeof(itsStoredSourceID) == 'string') {
                _root.report( "Yes, '"+ childID +"' has a stored sourceID '"+ itsStoredSourceID +"'" );
                // try to find its stored source
                for (testID in _root.objTemporalObjectRegistry) {
                    testObject = _root.objTemporalObjectRegistry[testID];
                    _root.report("checking reg (obj '"+ testID +"'/'"+ testObject.ID +"')");
                    if (testObject.ID == itsStoredSourceID) {
                        testObject.inflections.push( testChild );
                        testChild.source = testObject;
                        _root.report("| found the parent!");
                        _root.report("| parent now has '"+ testObject.inflections.length +"' inflections");
                        _root.report("| new inflection is '"+ testObject.inflections[testObject.children.length - 1].ID +"'");
                        _root.report("| new source is '"+ testChild.source.ID +"'");
                    }
                }
            }
              
            if (typeof(itsStoredTargetID) == 'string') {
                _root.report( "Yes, '"+ childID +"' has a stored targetID '"+ itsStoredTargetID +"'" );
                // try to find its stored target
                for (testID in _root.objTemporalObjectRegistry) {
                    testObject = _root.objTemporalObjectRegistry[testID];
                    if (testObject.ID == itsStoredTargetID) {
                        testObject.inflections.push( testChild );
                        testChild.target = testObject;
                    }
                }
            }
            // TODO: Force it to adopt its stored position immediately?
///         testChild.sprite.refreshDisplay();
		}
	}

	// Now clean up the objects in the registry of any storageIDs, to avoid collisions with
	// future loaded models
	for (objID in _root.objTemporalObjectRegistry) {
		anObject = _root.objTemporalObjectRegistry[objID];
		delete anObject.xmlSourceNode;
	}

	return "OK";
}


/* Check to see if a given item exists in a list (an Array or Object);
 * return true or false */
function itemFoundInList( targetItem, testList ) {
    // NOTE: By 'list', we mean an Array or Object (namespace)
    if ((testList instanceof Array) || (testList instanceof Object)) {
        var i, testItem;
        for (i in testList) {    // produces property name, or iterator for Arrays
            testItem = testList[i];
            if (testItem == targetItem) return true;    // found it!
        } 
        return false;
   } else {
        _root.report( "itemFoundInList(): Expected an Array or Object, not <"+ typeof(testList) +">" );
        return false;
    } 
}


// Capture all the specified objects (and their layers), as well as general
// PlaySpace settings, and return an XMLDOM. This model might be pushed to
// the server for storage, or copied to the clipboard
function freezeTemporalModel( arrSelectedObjects, blnIncludePSlabels, blnIncludePSlayout ) {
    /*  
     * If a listed object is itself a PlaySpaceLayer, then grab all its
     * contents just as before.
     *
     * If it's another class of object, find its PSLayer and add it (if
     * it's not there already) and the selected object.
     *
     * WATCH FOR DUPLICATES, especially if both an object and its PSLayer
     * were chosen for inclusion.
     */

    // If 'blnIncludePSlabels' is false, don't include label settings and
	// strip them from all included primitives
	if (blnIncludePSlabels == null)
		blnIncludePSlabels = true;	// true by default

    // If 'blnIncludePSlayout' is false, remove all references to PS layout
	// (position and scale of primitives) and rely on general layout rules to
	// organize these objects when loaded into the Play Space
	if (blnIncludePSlayout == null)
		blnIncludePSlayout = true;	// true by default
	
	// Create a new XMLDOM to hold our model data
	var xmlOutput = new XML( );
	xmlOutput.ignoreWhite = true;

	// Create and attach the main <TemporalModel> node
	var modelNode = xmlOutput.createElement( 'TemporalModel' );
	xmlOutput.appendChild( modelNode );
	// Now create and attach other major nodes

	// Create a settings node and attach core attributes
	var settingsNode = xmlOutput.createElement( 'PlaySpaceSettings' );
	modelNode.appendChild( settingsNode );
	// Always add the Play Space version (might determine data compatibility)
	settingsNode.attributes.psVersion = "??";	// TODO: Get from main PS movie?
	settingsNode.attributes.nowSliderActive = "true"; // TODO: Get real value
	settingsNode.attributes.nowSliderStyle = "1";
		// TODO: Get real value (perhaps a more descriptive string?)
	
	// Create and attach the main "collection" nodes
	var layersCollectionNode = xmlOutput.createElement( 'LayerCollection' );
	modelNode.appendChild( layersCollectionNode );

	var objectsCollectionNode = xmlOutput.createElement( 'TemporalObjects' );
	modelNode.appendChild( objectsCollectionNode );

	if (blnIncludePSlabels) {
		// Save these Play Space settings in the output XML
		// NOTE: This is a comma-delimited list of escape'd label names, with 
		// empty entries for untitled labels, for example:
		// "critical%20days,major%20causes,disruptive%20forces,,,major%20surprises,,,,"
		var n, labelName, safeName, strLabelList;
		var arrLabelNames = new Array();
		for (n = 0; n < _root.labels.length; n++) {	// TODO: Fill in the proper source here!
			// Add the name of each label in the Play Space (if any, or "")
			labelName = _root.labels[n];
				// load from the list; save an empty string if it's null!
			if (labelName == null) {
				safeName = "";
			} else {	// encode for safe storage
				safeName = escape( labelName );
			}
			arrLabelNames.push( safeName );
		}
		// Concatenate the layer names into a single string
		strLabelList = arrLabelNames.join(",");
		settingsNode.attributes.labels = strLabelList;
	}

    // Build a collection of all the layers we'll need
    var arrLayers = new Array();
    var i, testObject, itsLayer;
    for (i in arrSelectedObjects) { // an iterator
        testObject = arrSelectedObjects[i];
		var strReport = _root.DataLib.itemize( testObject );
        _root.report( "Testing selected objects for this model..." );
        if (testObject.className == 'PlaySpaceLayer') {
            _root.report( "  It's a PlaySpaceLayer!" );
            // they selected a PSLayer, so add it
            arrLayers.push( testObject );
        } else if (testObject.layerData) {
            _root.report( "  It's a PSLayer ENTRY!" );
            // it's a PSLayer entry, incl. "meta-data" about the layer;
            // let's extract the PSLayer object itself
            arrLayers.push( testObject.layerData );
        } else {
            _root.report( "  It's some kind of temporal object: '"+ testObject.className +"'");
            // it's another kind of object, find and add its Layer
			itsLayer = testObject.layer;
            arrLayers.push( itsLayer );
        }
    }

	// OK, now step through all the specified layer objects; capture
	// needed information about all their child objects (or just the
    // selected ones), and record it all as XML nodes. Store labels and
    // layout info too, if requested
	var layerID, objLayerEntry, objLayer, tempNode, childCount, c, objChild;
	
	var arrIncludedObjects = new Array();
		// We'll keep track of all objects in these layers, so that 
		// we can quickly test for any dependencies before saving..
    
	for (i in arrLayers) {     // increments
		objLayer = arrLayers[i];	// the actual PlaySpaceLayer object
		
		// Add a <layer> node for each included layer, with its name and description
		// Assume that their node order corresponds to Z-depth (back to front)!
		tempNode = xmlOutput.createElement( 'Layer' );
		layersCollectionNode.appendChild( tempNode );

		///var strReport = _root.DataLib.itemize( objLayer );
		///_root.report( "About the PlaySpaceLayer object:\n"+ strReport );
		
		// Let's add layer attributes in reverse order, Flash will flip 'em

		// first, some particulars about position, magnification

		// these are literal Flash coordinates etc from the object's sprite
		// NOTE: Each layer owns a stack of Flash sprite-instances; let's just read
		// from one member of this object/array (since all share common properties)
		var testSprite = objLayer.sprites[ 'points' ];
		if (!testSprite) {
			_root.WindowLib.report( "freezeToTemporalModel(): ERROR - missing Layer sprite 'points'!" );
			return "ERROR - missing Layer sprite 'points'!";
		}
		tempNode.attributes.spriteAlpha = 	testSprite._alpha;
		tempNode.attributes.spriteYscale = 	testSprite._yscale;
		tempNode.attributes.spriteXscale = 	testSprite._xscale;
		tempNode.attributes.spriteY = 		testSprite._y;
		tempNode.attributes.spriteX = 		testSprite._x;
		// TODO: The PlaySpaceLayer's props (should be more abstract, where 1.0 is 
		// the width of the current display area)

		// add the "granularity zoom" for Timelines, Intervals, etc. in this Layer
		tempNode.attributes.zoomLevel = _root.getMetadataForLayer( objLayer ).zoomLevel;
		
		// and now the basics
		tempNode.attributes.description = objLayer.description;
		tempNode.attributes.name = objLayer.name;
		tempNode.attributes.ID = objLayer.ID;
		
        if ((itemFoundInList( objLayer, arrSelectedObjects )) ||
            (itemFoundInList( _root.getMetadataForLayer(objLayer), arrSelectedObjects ))) {
            // add *all* objects in this layer to our included objects
            addLayerContents( objLayer, arrIncludedObjects );
        }
        // NOTE that ultimately, all the objects in this layer might be
        // rejected for some reason. Let's play it safe and keep the Layer
        // anyway, since its own properties might be important to this user
    }

    // now add the non-Layer selections (but watch for duplicates!)
    for (i in arrSelectedObjects) {
        testObject = arrSelectedObjects[i];
        if (testObject.className != 'PlaySpaceLayer') {
            // it's a candidate, make sure it's not already included
            if (!itemFoundInList( testObject, arrIncludedObjects )) {
                // it's a new one, add it now
                arrIncludedObjects.push( testObject );
            }
        }
    }
    var strReport = _root.DataLib.itemize( arrIncludedObjects, "*" );
    _root.report( "About the included objects:\n"+ strReport );
		
    // Test each of the included objects, to see if we should add it to the
    // <TemporalObjects> node. (Some classes won't be saved if they fail
    // certain tests.)
	var objectCount = arrIncludedObjects.length;
	var c, objChild, itsSprite;
    var includedInSavedModel;
    
	for (c = 0; c < objectCount; c++) {
        objChild = arrIncludedObjects[c];

        /* Some classes (e.g. inflections) have additional requirements to
         * be saved. Test here for dependencies and, if some requirement
         * isn't being met, skip to the next object.
         */
        includedInSavedModel = true;
        
        switch (objChild.className) {
            case 'Special':
            case 'Cancelled':
                // These inflections should have a single target object in our chosen layers
                if (!itemFoundInList( objChild.target, arrIncludedObjects )) {
                    // it's not being saved!
                    includedInSavedModel = false;
                }
                break;

            case 'Causality':
                // This inflection should have a source and target object; both must be
                // included in our chosen layers for this to save!
                if (!itemFoundInList( objChild.source, arrIncludedObjects )) {
                    // it's not being saved!
                    includedInSavedModel = false;
                }
                if (!itemFoundInList( objChild.target, arrIncludedObjects )) {
                    // it's not being saved!
                    includedInSavedModel = false;
                }
                break;

            default:
                // assume that the remaining classes are straightforward (save 'em)
                break;
        }
        
        // If we're not saving this object, skip to the next one
        if (!includedInSavedModel) {
            _root.report( "Not saving this '"+ objChild.className +"' -- missing dependencies!");
            continue;
        }

        // Still here? Then we're saving this object's data..
 
		// Add a node for this object, using the.className as its node-name
		tempNode = xmlOutput.createElement( objChild.className ); // eg. <Point>
		objectsCollectionNode.appendChild( tempNode );
		
        // Grab its sprite (movie clip instance) for additional properties
		childSprite = objChild.sprite;
        
        // Populate the new node with attributes. Note that we'll add them
        // "backwards" (class-specific attributes first, then the
        // generic/core attributes) for more legible XML
		switch (objChild.className) {
			case 'Axis':
				// store position, size, length (visual), duration (time), scale and granularity
				// these are literal Flash coordinates etc from the object's sprite
				tempNode.attributes.spriteWidth = childSprite.spriteWidth;	// = endCap._x;	
				tempNode.attributes.spriteY = childSprite._y;
				tempNode.attributes.spriteX = childSprite._x;
				// TEST the object's props (should be more abstract, where 1.0 is 
				// the width of the current display area)
				tempNode.attributes.totalDuration = objChild.totalDuration;
				tempNode.attributes.displayLength = objChild.displayLength;
				tempNode.attributes.displayY = objChild.displayY;
				tempNode.attributes.displayX = objChild.displayX;

				///tempNode.attributes.duration			// currently implied?
				///tempNode.attributes.zoom				// inherits from parent Layer?
				///tempNode.attributes.timeScale = objChild.
				///tempNode.attributes.granularity = objChild.
				break;
        
			case 'Event':
				// store position (on parent axis? or screen?), length (visual), duration (time),
				//	unary inflections
				tempNode.attributes.spriteWidth = childSprite.spriteWidth;	// = endCap._x;	
				tempNode.attributes.spriteY = childSprite._y;
				tempNode.attributes.spriteX = childSprite._x;
				tempNode.attributes.startTime = objChild.startTime;
				tempNode.attributes.endTime = objChild.endTime;
				break;
        
			case 'Interval':
				// store position (on parent axis? or screen?), length (visual), duration (time),
				//	unary inflections, "end conditions" (definite start? fuzzy end?)
				tempNode.attributes.spriteWidth = childSprite.spriteWidth;	// = endCap._x;	
				tempNode.attributes.spriteY = childSprite._y;
				tempNode.attributes.spriteX = childSprite._x;
				tempNode.attributes.startTime = objChild.startTime;
				tempNode.attributes.endTime = objChild.endTime;
				break;
        
			case 'Instant':
				// store position (on parent axis? or screen?), unary inflections
				tempNode.attributes.spriteY = childSprite._y;
				tempNode.attributes.spriteX = childSprite._x;
				tempNode.attributes.position = objChild.position;
				break;

			case 'Special':
			case 'Cancelled':
                // Store the ID of its target object, plus description etc
				tempNode.attributes.targetID = objChild.target.ID;
				break;

			case 'Causality':
                // Store IDs of source and target object, strength, etc
				tempNode.attributes.sourceID = objChild.source.ID;
				tempNode.attributes.targetID = objChild.target.ID;
                tempNode.attributes.strength = objChild.strength;
                // stash the X and Y position of its label (dictates curve
                // of the arrow's arc)
                tempNode.attributes.labelX = objChild.sprite.slidingLabel._x;
                tempNode.attributes.labelY = objChild.sprite.slidingLabel._y;
				break;

		}
        
        /* Test for common-but-not-universal properties next */
        
        // Add IDs of this object's children, if any
		if (objChild.children) {
            var cc, subChild, strChildrenIDs;
		    var arrChildrenIDs = new Array();
///			_root.report("testing "+ objChild.children.length +" children of '"+ objChild.ID +"'...");
			// add IDs of any children in a composite attribute
			for (cc = 0; cc < objChild.children.length; cc++) {
				subChild = objChild.children[cc];
				_root.report("found a "+ subChild.className +" called '"+ subChild.ID +"'");
                // Test each child, to see if it's along for the ride
                if (itemFoundInList( subChild, arrIncludedObjects ))
                    arrChildrenIDs.push( subChild.ID );			
			}
			strChildrenIDs = arrChildrenIDs.join(",");
			tempNode.attributes.childrenIDs = strChildrenIDs;
		}
        
        // Add IDs of this object's inflections, if any
		if (objChild.inflections) {
            var cc, subChild, strChildrenIDs;
		    var arrChildrenIDs = new Array();
///			_root.report("testing "+ objChild.inflections.length +" inflections of '"+ objChild.ID +"'...");
			// add IDs of any inflections in a composite attribute
			for (cc = 0; cc < objChild.inflections.length; cc++) {
				subChild = objChild.inflections[cc];
				_root.report("found a "+ subChild.className +" called '"+ subChild.ID +"'");
                // Test each inflection, to see if it's along for the ride
                if (itemFoundInList( subChild, arrIncludedObjects ))
                    arrChildrenIDs.push( subChild.ID );			
			}
			strChildrenIDs = arrChildrenIDs.join(",");
			tempNode.attributes.inflectionIDs = strChildrenIDs;
		}

        // TODO: Add 'contentsIDs' (if .contents), for Layer and
        // Encompassing Mood
        
        /* Add "core" (universal) properties last (they'll appear first in
         * the resulting XML)
         */
        
		// Include label index (list position? or name? both for now..) and strength
		if (objChild.labelIndex == null) {	// this object has no label
			tempNode.attributes.labelIndex = "";
			tempNode.attributes.labelName = "";
			tempNode.attributes.labelStrength = "";
		} else {
			tempNode.attributes.labelIndex = objChild.labelIndex;
			tempNode.attributes.labelName = _root.labels[ objChild.labelIndex ];
			tempNode.attributes.labelStrength = objChild.labelStrength;
		}
        
        // Test the parent object, to see if it's along for the ride
        if (objChild.parent != undefined) {  // don't assume there's a parent!
            if (itemFoundInList( objChild.parent, arrIncludedObjects )) {
                tempNode.attributes.parentID = objChild.parent.ID;
            } else {   
                // it's not included; use the layer ID as parent
                tempNode.attributes.parentID = objChild.getLayer().ID;
            }
        }
		tempNode.attributes.layerID = objChild.layer.ID;
		tempNode.attributes.description = objChild.description;
		tempNode.attributes.name = objChild.name;
		tempNode.attributes.ID = objChild.ID;
	}
        
	return xmlOutput;
}


function getAllDescendants( objTarget, arrDescendants ) {
	// Add any children of the target to the provided array
	// NOTE that this is a recursive function; any child object
	// that has children of its own should be called too
	if (objTarget.children) {
		// add each child to the array, and recursively call each one
		var childCount = objTarget.children.length;
		var c, objChild;
		for (c = 0; c < childCount; c++) {
			objChild = objTarget.children[c];
			arrDescendants.push( objChild );
			arrDescendants = getAllDescendants( objChild, arrDescendants );
		}
	} // else this object has no children, return the array unchanged

	return arrDescendants;
}


function addLayerContents( objLayer, arrObjects ) {
	// Check the global registry of temporal objects; add any which
	// belong to the specified layer to the provided array (test by 
	// checking the ancestry of each object)
    //
    // NOTE that we're not watching for duplicates here, or for special
    // dependencies that a class might impose. Just adding to a list.
	var registry = _root.objTemporalObjectRegistry;
	var anID, anObject, itsLayer;
    var i, testInflection, j, alreadyStored;
	for (anID in registry) {
		// test each object... does its layer match?
		anObject = registry[ anID ];
		if (anObject.className != 'PlaySpaceLayer') {
            // skip the Layer objects, add all others
			itsLayer = anObject.layer;
			if (itsLayer == objLayer) {
				// it belongs to the specified layer! add it now
				arrObjects.push( anObject );
            }
		}
	}
    // No need for a return value, since we're modifying an existing array
    return;     
}


function groomIncomingModelXML( modelNode, arrIncludedLayerNodes, blnConsolidateLayers ) {
    /* Here we'll do a number of things to refine the XML of an incoming
     * model (one about to be introduced into the Play Space)
     */
    var layerCollectionNode = _root.XMLSupportLib.selectSingleNode( modelNode, 'LayerCollection' );
    if (layerCollectionNode.nodeName != 'LayerCollection') {
        _root.report( "groomIncomingModelXML(): <LayerCollection> node not found!" );
        return "groomIncomingModelXML(): <LayerCollection> node not found!";
    }
    var objectCollectionNode = _root.XMLSupportLib.selectSingleNode( modelNode, 'TemporalObjects' );
    if (objectCollectionNode.nodeName != 'TemporalObjects') {
        _root.report( "groomIncomingModelXML(): <TemporalObjects> node not found!" );
        return "groomIncomingModelXML(): <TemporalObjects> node not found!";
    }
     
    // Remove any unwanted Layer nodes, and their associated object nodes
    var layerNode, doomedLayerNode, doomedLayerID, objectNode, doomedObjectNode;
    layerNode = layerCollectionNode.firstChild;
	while (layerNode != null) {
        if (!itemFoundInList( layerNode, arrIncludedLayerNodes )) {
            // this is not an included layer; delete it and its children!
            doomedLayerNode = layerNode;
            doomedLayerID = doomedLayerNode.attributes.ID;
            _root.report( "Removing unwanted Layer '"+ doomedLayerID +"'..." );

            // find and remove all objects in this layer
            objectNode = objectCollectionNode.firstChild;
            while (objectNode != null) {
                if (objectNode.attributes.layerID == testLayerID) {
                    // Yes, this object belongs to the doomed layer
                    doomedObjectNode = objectNode;
                    // step to the next object, then delete this one
                    objectNode = objectNode.nextSibling;
                    doomedObjectNode.removeNode();
                } else {
                    // step to the next object node (if any) and continue
                    objectNode = objectNode.nextSibling;
                }
            }
            
            // step to the next layer, then delete this one
            layerNode = layerNode.nextSibling;
            doomedNode.removeNode();
        } else {
            // this is an included layer, just step to the next one
            _root.report( "Keeping Layer '"+ layerNode.attributes.ID +"'..." );
            layerNode = layerNode.nextSibling;
        }

    }
    // Now we have a smaller model, just the selected layers and their
    // children
    _root.report( "Here's the leaner, meaner model:\n"+ modelNode.toString() );
    
    // Assign unique Play Space IDs to all objects in the incoming model,
    // except for any layers that we're consolidating (with same-named
    // layers currently in the Play Space)
    var arrOldIDs = new Array();
    var arrNewIDs = new Array();
    var nextAvailableID;
    
    // Sweep through the layers, then the objects in this model; we
    // should assign a new ID to each, and add the old/new IDs to our
    // arrays for later..
    
    // Re-assign all layer IDs
    var storedLayerName, p, testPSlayer;
    layerNode = layerCollectionNode.firstChild;
	while (layerNode != null) {
        // Find the next available Play Space ID (e.g. "PlaySpaceLayer_3")
        nextAvailableID = null;
        if (blnConsolidateLayers) {
            // attempt to find a matching (same-named) layer in the Play
            // Space, and use its ID for this layer
            var storedLayerName = layerNode.attributes.name;
            for (p in _root.arrLoadedLayers) {  // iterator
                testPSlayer = _root.arrLoadedLayers[p];
                // Does this existing Play Space layer have the same name
                // as our incoming layer?
                if (storedLayerName == testPSlayer.name) {
                    // it's a match! use this ID for objects in this layer
                    nextAvailableID = testPSlayer.ID;
                    break;  // use the first matching layer name
                }
            }
        }
        if (!nextAvailableID) {
            // no match found, give it a new ID
            nextAvailableID = "PlaySpaceLayer"+ _root._generic_getUniqueID( );        
        }
        
        // make matching additions (n-th place) in both ID arrays
        arrOldIDs.push( layerNode.attributes.ID );
        arrNewIDs.push( nextAvailableID );

        // reset the node's array to the new one
        layerNode.attributes.ID = nextAvailableID;

        // step to the next layer, then delete this one
        layerNode = layerNode.nextSibling;
    }
    // Re-assign all object IDs
    objectNode = objectCollectionNode.firstChild;
    while (objectNode != null) {
        // Find the next available Play Space ID (e.g. "Point_23")
        nextAvailableID = objectNode.nodeName + _root._generic_getUniqueID( ); 

        // make matching additions (n-th place) in both ID arrays
        arrOldIDs.push( objectNode.attributes.ID );
        arrNewIDs.push( nextAvailableID );

        // reset the node's array to the new one
        objectNode.attributes.ID = nextAvailableID;

        // step to the next layer, then delete this one
        objectNode = objectNode.nextSibling;
    }
    // OK, now we should have two matched arrays, with old and new IDs
    _root.report( "Again, with new core IDs:\n"+ modelNode.toString() );

    // Now check relevant links in all objects; reset IDs to their new
    // counterparts, or respond if the linked ID isn't among the incoming
    // objects; either cull this object, or let its link(s) dangle
    objectNode = objectCollectionNode.firstChild;
    var oldID, idPos, newID;
    while (objectNode != null) {
        // Test for link properties (for each class of object), and remap
        // them all to our list of new IDs
        switch (objectNode.nodeName) {
            case 'Instant':
                remapToNewIDs(
                    objectNode, 
                    arrOldIDs,
                    arrNewIDs, 
                    ['parentID', 'layerID', 'childrenIDs', 'inflectionIDs']
                );
                // step to the next object in any case
                objectNode = objectNode.nextSibling;
                break;
            case 'Event':
                remapToNewIDs(
                    objectNode, 
                    arrOldIDs,
                    arrNewIDs, 
                    ['parentID', 'layerID', 'inflectionIDs']
                );
                objectNode = objectNode.nextSibling;
                break;
            case 'Interval':
                remapToNewIDs(
                    objectNode, 
                    arrOldIDs,
                    arrNewIDs, 
                    ['parentID', 'layerID', 'inflectionIDs']
                );
                objectNode = objectNode.nextSibling;
                break;
            case 'Axis':
                remapToNewIDs(
                    objectNode, 
                    arrOldIDs,
                    arrNewIDs, 
                    ['parentID', 'layerID', 'childrenIDs', 'inflectionIDs']
                );
                objectNode = objectNode.nextSibling;
                break;
            case 'Special':
            case 'Cancelled':
                remapToNewIDs(
                    objectNode, 
                    arrOldIDs,
                    arrNewIDs, 
                    ['targetID', 'layerID']
                );
                // Cull out this inflection if its target object isn't
                // loaded
                if (objectNode.attributes.targetID == "") {
                    doomedNode = objectNode;
                    objectNode = objectNode.nextSibling;
                    doomedNode.removeNode();
                } else {
                    // step to the next object
                    objectNode = objectNode.nextSibling;
                }
                break;
            case 'Causality':
                remapToNewIDs(
                    objectNode, 
                    arrOldIDs,
                    arrNewIDs, 
                    ['sourceID', 'targetID', 'layerID']
                );
                // Cull out this inflection if its source or target objects
                // aren't loaded
                if ((objectNode.attributes.sourceID == "") ||
                    (objectNode.attributes.targetID == "")) {
                    doomedNode = objectNode;
                    objectNode = objectNode.nextSibling;
                    doomedNode.removeNode();
                } else {
                    // step to the next object
                    objectNode = objectNode.nextSibling;
                }
                break;
            default:
                _root.report("groomIncomingModelXML(): Unknown object class <"+ objectNode.className +">!");
        }
    }
    _root.report( "Once more, with all new IDs:\n"+ modelNode.toString() );
    
    return modelNode;
}

// Here's a support function that remaps from old to new IDs
function remapToNewIDs( objectNode, arrOldIDs, arrNewIDs, arrIDAttributes ) {
    var i, attrName, strOldValue, arrOldValues, j, anOldValue
    var k, arrNewValues, strNewValue;
    for (i in arrIDAttributes) {
        attrName = arrIDAttributes[i];
        strOldValue = objectNode.attributes[ attrName ];
        // split into an array (just in case it's more than one ID)
        arrOldValues = strOldValue.split(',');
        arrNewValues = new Array();
        for (j in arrOldValues) {
            anOldValue = arrOldValues[j];
            // look for this in the old-IDs list
            for (k in arrOldIDs) {
                if (arrOldIDs[k] == anOldValue) {
                    // found a match in the n-th position! plug in the
                    // matching ID from the new-IDs list
                    _root.report("### replacing old value '"+ anOldValue +"' with '"+ arrNewIDs[k] +"'");
                    arrNewValues.push( arrNewIDs[k] );
                    break;  // abandon inner loop, proceed to next value
                }
            }
            // still here? then no match was found, so omit this value
        }
        // Re-assemble whatever values were found. The result should be
        // either a single ID in a string, or a series of matched,
        // comma-delimited IDs, or an empty string (if nothing matched)
        strNewValue = arrNewValues.join(',');
        _root.report( "  new value for '"+ attrName +"' is '"+ strNewValue +"'")
        objectNode.attributes[ attrName ] = strNewValue;
    }
}

trace("ModelWranglers loaded successfully");
