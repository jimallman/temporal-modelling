##
##   Copyright 2010 by the Rector and Visitors of the University of Virginia
##
##   Licensed under the Apache License, Version 2.0 (the "License");
##   you may not use this file except in compliance with the License.
##   You may obtain a copy of the License at
##
##       http://www.apache.org/licenses/LICENSE-2.0
##
##   Unless required by applicable law or agreed to in writing, software
##   distributed under the License is distributed on an "AS IS" BASIS,
##   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
##   See the License for the specific language governing permissions and
##   limitations under the License.
##

# The Resource Library is a Zope object--a Folder with these
# external methods, plus internal storage areas for private and
# public resources (data models, etc)
#
# By calling the ResourceLibrary, these methods can be called
# using XML-RPC, or (within reason) directly via URL+querystring
#
# NOTE: Using external methods means we can handle XML-RPC
# arguments in a normal fashion (versus DTML clumsiness).


# Assume the following structured args in all methods:
#
# 'authInfo' is a dictionary in this format:
#     {'name':'Joe Blow', 'password':'secretsauce'}
# This should always be optional, for normal HTML requests, but
# is available to support authentication from Flash XML-RPC (which
# doesn't support HTTP Basic Authentication)
#
# 'resourceID' is a string (NOT necessarily an int), a unique identifier
#
# 'resourceMetadata' is a dictionary in this format:
#     {'type':'story', 'name':'Tale of Two Cities', 'description':'It was the best...'}
#
# 'resourceData' is an XML string

   
def userHasPermission( user, permission, object ):
   import AccessControl.PermissionRole
   # While this is similar to User.has_permission, NOTE that this
   # really will check for permission on behalf of *any* User!

   # First we get the roles they'll need to do what they want
   neededRoles = AccessControl.PermissionRole.rolesForPermissionOn( permission, object )
   if type(neededRoles) is type('a'):  # make sure it's a list!
      neededRoles = [neededRoles]
      
   # Now test to see if this user *has* any of the needed roles
   return user.allowed( object, neededRoles )


def listResources( self, whichType='all', authInfo=None ):
   # Return an XML index of all resources (with IDs and metadata)
   # that are visible to this user
   #TODO: Why is this receiving 3 arguments? Who's sending the 3rd?!
   theUser = getCurrentUser( self, authInfo )

   # 'whichType' should be 'private', 'shared', or 'all' (default)
   # Retrieve from appropriate storage containers in each case
   if whichType == 'private':
      privateFolder = getPrivateFolderForUser( self, theUser )
      if privateFolder is None:
         return "ERROR: No private folder for user '%s'!" % (theUser)
      containerList = [privateFolder]

   elif whichType == 'shared':
      containerList = [self.SharedData]

   else:    # include models from both libraries (MY private, and shared)
      privateFolder = getPrivateFolderForUser( self, theUser )
      if privateFolder is None:
         return "ERROR: No private folder for user '%s'!" % (theUser)
      containerList = [self.SharedData, privateFolder]

### DIAGNOSTIC
#   testOut  = "found %s containers:\n" % len(containerList)
#   for aContainer in containerList:
#      testOut += "  %s\n" % aContainer
#   return testOut
   
   listXML = """<xml>
      <!-- Here's a list of %s resources on this server -->
      <!-- current user is '%s' -->
      <ResourceCollection>
      """ % (escapeForXML(whichType), escapeForXML(theUser.getUserName()) )
   
   # Buzz through all the listed containers, listing resources in each
   for aContainer in containerList:
      # Add an XML node for each Container (insert ID and Zope-path)
      containerID = escapeForXML( aContainer.getId() )
      containerPath = escapeForXML( aContainer.absolute_url( relative=self.ResourceLibrary ) )
      listXML += """
         <Container id="%s" path="%s">
      """ % (containerID, containerPath)
      
      for aModel in aContainer.objectValues('DTML Document'):
         # For each model found, add an XML node describing its metadata
         # (using a formatting string to build the XML)
         listXML += """
            <%s
             ID="%s"
             name="%s"
             description="%s"
             path="%s" />
         """ % (
            getattr(aModel, 'resourceType', "resource"),
            escapeForXML( aModel.getId() ),
            escapeForXML( aModel.title ),
            escapeForXML( getattr(aModel, 'description', "No description") ),
            escapeForXML( aModel.absolute_url( relative=self.ResourceLibrary ) )
            )
         #, aModel.getId(), aModel.title(), aModel.description(), aModel.absolute_url())

      # Add closing Container tag
      listXML += """
         </Container>
      """
      
   # Add closing collection tag
   listXML += """
      </ResourceCollection>
   </xml>"""
   return listXML


########### Managing resources (stored items in Library) ###############

def fetchResource( self, resourcePath='', authInfo=None ):
   import AccessControl, AccessControl.PermissionRole
   # Return a structure including XML data *and* library meta-data,
   # or an error message (resource not found, or authorization failed, etc)
   if resourcePath == '':
      return "ERROR: No resourcePath provided!"

   theUser = getCurrentUser( self, authInfo )
   # Try to find the named resource
   desiredResource = self.unrestrictedTraverse( path=resourcePath, default=None )
   if not desiredResource:
      return "ERROR: Resource at '%s' not found!" % (resourcePath)

   #return theUser.has_permission( 'View', desiredResource )
   # Hm, this returns 1 through the HTML view, 0 through XML-RPC!?
   # OH, I see the problem. It stupidly assumes that we're only
   # interested in the current authenticated user, and would never
   # want to check on someone else's permissions. (D'oh!)

   # If they have permission to view it, send the data
   # NOTE: We'll use our own version of 'has_permission', which works
   if userHasPermission( theUser, 'View', desiredResource ):
      #return desiredResource.document_src()
      resourceInfo = {
         'resourceType':   desiredResource.resourceType,
         'name':           desiredResource.title,
         'description':    desiredResource.description,
         'folderPath':     desiredResource.aq_parent.absolute_url(relative=self.ResourceLibrary),
         'ID':             desiredResource.getId(),
         'ownerID':        desiredResource.owner_info()['id'],
         'data':           desiredResource.document_src()
         }
      return resourceInfo
   else:
      return "ERROR: User '%s' not authorized to view the resource '%s'!" % (theUser, resourcePath)
   

def addOrUpdateResource( self, folderPath, ID, name, description, resourceData, type='', authInfo=None, requestor='XML-RPC' ):
   # Add the data as a new resource, or (if it exists already) update its
   # metadata or XML-data to reflect recent changes

   # NOTE: 'folderPath' is a Zope path *relative* to 'ResourceLibrary'
   # Let's try to traverse there now..
   libRoot = self.ResourceLibrary
   ##return folderPath# == 'PrivateData/JeffersonHigh/3rdPeriod/Billy'
   targetFolder = libRoot.unrestrictedTraverse( path=folderPath, default=None )

   if (targetFolder != None):
      # keep going, we found the folder
      x=0   # this is pointless, to justify this indented block (because this test doesn't work with '==' or 'is')!
   else:
      return "ERROR: Unable to find this Folder: '%s'!" % (folderPath)

   # Check to see if the user has permission to add or update resources here
   theUser = getCurrentUser( self, authInfo )

   if not userHasPermission( theUser, 'Change DTML Documents', targetFolder ):
      # never mind, they're not authorized to do this
      return "ERROR: User '%s' is NOT allowed to add or update in folder '%s'!" % (theUser, targetFolder.getId())

   if ID == '':
      # It's a new resource, create it in the Folder at 'folderPath'

      # Pull the next (serial) ID of the Library's stack
      newIDnumber = _getNextAvailableID(self);
      if type == '':  # no type specified, just use generic ID "generic_123"
         itsType = 'generic';
      else:
         itsType = type;
      # reset the argument 'ID' to have its new ID
      ID = "%s_%s" % (itsType, newIDnumber);
   
      # OK, create the new resource. NOTE the funky intermediate object (ObjectManager?)
      # that's necessary here...
      targetFolder.manage_addProduct['OFSP'].manage_addDTMLDocument(id=ID, title=name);

      #return targetFolder[ID].absolute_url()

      # Now test to see if the object was added successfully
      testObj = getattr(targetFolder, ID, None);
   
      if testObj is None:  # not found!
         return "ERROR: Unable to add resource '%s/%s'!" % (folderPath, ID);
      else:               # found our new child object successfully
         testObj.manage_addProperty('description', "", 'string');
         # NOTE that this will be immediately over-written downstream..
         testObj.manage_addProperty('resourceType', itsType, 'string')
         
   # end of exceptional behavior for new resources

   # Traverse to the target resource at "folderPath/ID"
   #TODO: Confirm that it exists, and that we have permission
   fullPathToResource = "%s/%s" % (folderPath, ID)
   targetResource = libRoot.unrestrictedTraverse( path=fullPathToResource, default=None )
   if targetResource is None:  #TODO: Test for failure? Is this right?
      return "ERROR:Unable to traverse to the target resource at '%s'!" % (fullPathToResource)
   
   # Modify the object's attributes and data
   targetResource.manage_edit(data=resourceData, title=name) # changes its resource-data and name
   targetResource.manage_changeProperties( description = description )

   # Now provide the appropriate return value based on who's asking
   if requestor == 'XML-RPC':  # respond with the updated resource (to update metadata)
      return fetchResource(self, resourcePath=fullPathToResource, authInfo=authInfo)
   else:
      # we were called from the HTML interface, so render the target Folder's page
      ##return targetResource.aq_parent.index_html(self.REQUEST)
      self.REQUEST.RESPONSE.redirect( targetResource.aq_parent.absolute_url() )
      #self.REQUEST.RESPONSE.redirect( self.REQUEST.HTTP_REFERER )


def deleteResource(  self, resourcePath='', authInfo=None, requestor='XML-RPC', ignoreMe='BOGUS' ):
   # Remove the resource at the specified path, IF this user
   # has the necessary permission to do so; return result code (if XML request)
   # or re-direct to its container (if HTML request)
   # - 'resourcePath' should be relative to 'ResourceLibrary'
   
   # Once again, we're receiving a mysterious third argument (None?) -- Why?!
   ##return "self=%s, resourcePath=%s, ignoreMe=%s" % (self, resourcePath, ignoreMe)

   targetResource = self.ResourceLibrary.unrestrictedTraverse( path=resourcePath, default=None )
   if not targetResource:
      return "ERROR: No resource found at '%s'!" % (resourcePath)

   # Check to see if the user has permission to delete this resource
   theUser = getCurrentUser( self, authInfo )
   if userHasPermission( theUser, 'Delete Objects', targetResource ):
      targetID = targetResource.getId()
      targetParent = targetResource.aq_parent
      targetParent.manage_delObjects( [targetID] )
      if requestor == 'XML-RPC':
         return "<OK/>"
      else:               # we were probably called from HTML
         self.REQUEST.RESPONSE.redirect( targetParent.absolute_url() )
   else:
      return "ERROR: User '%s' is NOT authorized to delete this resource! \n\n%s" % (theUser, targetResource.getId())
      

########### Managing user accounts (incl. a private storage folder) ###############

def addOrUpdateAccount( self, isNewAccount, loginName, folderName, parentFolderPath, newPassword, confirmPassword, canAddSubgroups=0, newFolderName=None, sizeAllowedKB="32", requestor='XML-RPC' ):
   # Add (or modify) a user account with Library features:
   #  - We assume the loginName is valid for uniqueness (test client-side)
   #  - Each user has a private folder, which they manage (local role)
   libRoot = self.ResourceLibrary

   # Let's try to traverse to the group folder first
   groupFolder = libRoot.unrestrictedTraverse( path=parentFolderPath, default=None )
   if not groupFolder:
      return "ERROR: group folder '%s' not found!" % (parentFolderPath)

   # Oh, and grab our big user folder (for the entire app)
   bigUserFolder = libRoot.aq_parent.acl_users
   if not bigUserFolder:
      return "ERROR: No main User Folder found for app '%s'!" % (libRoot.aq_parent.getId())

   # Are we creating a new account, or modifying an old one?
   if int(isNewAccount) == 1:
      # Test to make sure it's a unique user-name
      if bigUserFolder.getUser( loginName ):
         # This account already exists, let's not mess it up
         return "ERROR: Sorry, a user with the name '%s' already exists." % (loginName)

      # Create the new user in our main User Folder
      bigUserFolder._addUser(
         loginName,
         newPassword,
         confirmPassword,
         ['Authenticated'],
         domains=[])   

      # If no folder name was specified, use the specified userid as its name
      if folderName == '':
         folderName = loginName

      # Create their private Folder inside current group folder
      # Is there already a folder by this name? That would be a Bad Thing
      testFolder = getattr(groupFolder, folderName, None)
      if testFolder:
         return "ERROR: There's already a user folder here: 's'" % (testFolder.absolute_url(relative=self.ResourceLibrary))

      # OK, create the private folder.NOTE the funky intermediate object (ObjectManager?)
      # that's necessary here...
      groupFolder.manage_addProduct['OFSP'].manage_addFolder(id=folderName, title=folderName);
      # Set up its local role (new user is Manager here)
      privateFolder = getattr(groupFolder, folderName, None)
      if not privateFolder:
         return "ERROR: couldn't create the private folder!"
      privateFolder.manage_setLocalRoles(userid=loginName, roles=['Manager'])
      # Set up other special properties
      privateFolder.manage_addProperty( id='subtype', value='MEMBER', type='string' )
      privateFolder.manage_addProperty( id='canAddSubgroups', value=canAddSubgroups, type='boolean' )
      privateFolder.manage_addProperty( id='sizeAllowed', value=sizeAllowedKB, type='int' )
      
   else:    # we're editing an existing account
      # Test to make sure the account already exists

      # grab the private folders
      privateFolder = groupFolder[folderName]
      if not privateFolder:
         return "ERROR: Sorry, I can't find the private folder '%s'!" % ("%s/%s" % (parentFolderPath, folderName))
      # and grab the assigned user
      if not bigUserFolder.getUser( loginName ):
         return "ERROR: Sorry, I can't find user '%s'." % (loginName)

      # Now update the values of its special properties
      privateFolder.manage_changeProperties(
         {'canAddSubgroups':int(canAddSubgroups), 'sizeAllowed':int(sizeAllowedKB) }
         )

      # Rename the private folder?
      if newFolderName != '' and newFolderName != None: # did they pass a new folder name?
         if privateFolder.getId() != newFolderName:   # has it changed?
            groupFolder.manage_renameObject(id=(privateFolder.getId()), new_id=newFolderName)
            privateFolder.manage_changeProperties( {'title':newFolderName} )
      else: # if they've cleared the newFolderName field, then it should mirror the login name!
         if not getattr(groupFolder, loginName, None):  # sanity check for like-named folder..
            groupFolder.manage_renameObject(id=(privateFolder.getId()), new_id=loginName)
            privateFolder.manage_changeProperties( {'title':loginName} )

      # Change this account's password?
      if newPassword == confirmPassword:
         if len(newPassword) > 0:   # ignore this if field is blank
            #bigUserFolder.userFolderEditUser(name=loginName, password=newPassword, roles=['Manager'])            
            bigUserFolder._changeUser(name=loginName,
                                      password=newPassword,
                                      confirm=newPassword,
                                      roles=['Authenticated'],
                                      domains=[]
                                      )            
      else:
         return "ERROR: Password didn't match, please try again."


   # Now provide the appropriate return value based on who's asking
   if requestor == 'XML-RPC':  # respond with simple XML, including the resource's path
      return '<OK>%s</OK>' % ( privateFolder.absolute_url() )
   else:
      # we were called from the HTML interface, so render the target Folder's page
      self.REQUEST.RESPONSE.redirect( groupFolder.absolute_url() )


def deleteAccount( self, privateFolderPath='', ignoreMe='BOGUS' ):
   # Remove the account folder at the specified path, IF this user
   # has the necessary permission to do so. NOTE that this also requires
   # that we remove its appointed Manager (see local roles) from the
   # main User Folder, and destroy (or re-assign) their resources in
   # the shared area.
   #
   # Perhaps there's an option 'deleteAllData=T/F'? If false, then we
   # change ownership of all resources and folders to the acting
   # manager (current user)

   # Return result-fragment (if XML request), or re-direct to its parent
   # container (a group folder) if it's an HTML request
   # - 'privateFolderPath' should be relative to 'ResourceLibrary'
   
   # Grab the private folder and its parent container
   privateFolder = self.ResourceLibrary.unrestrictedTraverse( privateFolderPath, default=None )
   if privateFolder is None:
      return "ERROR: private folder '%s' not found!" % (privateFolderPath)      

   itsGroupFolder = privateFolder.aq_parent
   
   # Fetch the current user, and test for needed permissions
   currentUser = self.REQUEST.AUTHENTICATED_USER
   if currentUser.has_permission( 'Delete Objects', itsGroupFolder ):

      # identify the private folder's associated user (local Manager)
      localManagers = privateFolder.users_with_local_role('Manager')
      if len(localManagers) == 0:
         return "ERROR: No local manager found in folder '%s'!" % (privateFolder.getId())
      if len(localManagers) > 1:
         return "ERROR: Multiple local managers found in folder '%s'!" % (privateFolder.getId())
      localManagerName = localManagers[0]

      # remove any of this user's resources in the shared area
      doomedResourceIDs = []
      sharedDataFolder = self.ResourceLibrary.SharedData
      for aSharedResource in sharedDataFolder.objectValues('DTML Document'):
         # get the name of the owner of this resource
         itsOwnerName = aSharedResource.owner_info()['id']
         if itsOwnerName == localManagerName:
            # it's owned by the account we're deleting
            doomedResourceIDs.append( aSharedResource.getId() )
      if len(doomedResourceIDs) > 0:
         sharedDataFolder.manage_delObjects( doomedResourceIDs )
            
      # delete any groups defined inside (recurse until all contents are clear)
      for aSubfolder in privateFolder.objectValues('Folder'):
         # delete each sub-folder
         self.deleteGroup( groupFolderPath=aSubfolder.absolute_url(relative=self.ResourceLibrary) )

      # delete the private folder
      targetID = privateFolder.getId()
      itsGroupFolder.manage_delObjects( [targetID] )

      # remove the associated user
      bigUserFolder = self.ResourceLibrary.aq_parent.acl_users
      bigUserFolder._delUsers( [localManagerName] )
      
      if self.REQUEST:  # we were probably called from HTML
         # redirect to a view of its parent group (updated member list)
         self.REQUEST.RESPONSE.redirect( itsGroupFolder.absolute_url() )
      else:             # we were probably called from script, or XML-RPC
         return "<OK/>"
   else:
      return "ERROR: User '%s' is NOT authorized to delete this account!" % currentUser
      

########### Managing user groups (clusters of user accounts) ###############

def addOrUpdateGroup( self, isNewGroup, parentFolderPath, groupName, newGroupName=None, requestor='XML-RPC' ):
   # Add (or modify) a user group (cluster of private data folders)
   libRoot = self.ResourceLibrary

   # Let's try to traverse to the parent folder first
   parentFolder = libRoot.unrestrictedTraverse( path=parentFolderPath, default=None )
   if not parentFolder:
      return "ERROR: group's parent folder '%s' not found!" % (parentFolderPath)

   # Are we creating a new group, or modifying an old one?
   if int(isNewGroup) == 1:
      # Create the group's Folder inside the parent folder
      # Is there already a local group by this name? That would be a Bad Thing

      testGroup = getattr(parentFolder, groupName, None)
      if testGroup:
         foundPath = testGroup.absolute_url()
         return "ERROR: There's already a group folder here: \n\n'%s'" % (foundPath)

      # OK, create the group folder. NOTE the funky intermediate object (ObjectManager?)
      # that's necessary here...
      parentFolder.manage_addProduct['OFSP'].manage_addFolder(id=groupName, title=groupName);
      # make sure we can get the new group folder
      groupFolder = getattr(parentFolder, groupName, None)
      if not groupFolder:
         return "ERROR: couldn't create the group folder!"
      # Set up other special properties
      groupFolder.manage_addProperty( id='subtype', value='GROUP', type='string' )
      
   else:    # we're editing an existing account
      # Test to make sure the account already exists

      # grab the group folder
      groupFolder = getattr( parentFolder, groupName, None )
      if not groupFolder:
         return "ERROR: Sorry, I can't find the group folder '%s'!" % ("%s/%s" % (parentFolderPath, folderName))

      # Rename the group folder?
      if newGroupName: # did they pass a new group name?
         if groupFolder.getId() != newGroupName:   # has it changed?
            parentFolder.manage_renameObject(id=(groupFolder.getId()), new_id=newGroupName)
            groupFolder.manage_changeProperties( {'title':newGroupName} )

   # Now provide the appropriate return value based on who's asking
   if requestor == 'XML-RPC':  # respond with simple XML, including the resource's path
      return '<OK>%s</OK>' % ( groupFolder.absolute_url() )
   else:
      # we were called from the HTML interface, so render the target Folder's page
      self.REQUEST.RESPONSE.redirect( parentFolder.absolute_url() )


def deleteGroup( self, groupFolderPath='', ignoreMe='BOGUS' ):
   # Remove the group folder at the specified path, IF this user
   # has the necessary permission to do so. NOTE that this also requires
   # that we delete all of its member accounts (see child 'MEMBER' folders)
   #
   # Perhaps there's an option 'deleteAllData=T/F'? If false, then we
   # change ownership of all resources and folders to the acting
   # manager (current user)

   # Return result-fragment (if XML request), or re-direct to its parent
   # container (the administrative account folder) if it's an HTML request
   # - 'groupFolderPath' should be relative to 'ResourceLibrary'
   
   # Grab the group folder and its parent container
   groupFolder = self.ResourceLibrary.unrestrictedTraverse( groupFolderPath, default=None )
   if not groupFolder:
      return "ERROR: group folder '%s' not found!" % (privateFolderPath)      

   parentFolder = groupFolder.aq_parent
   
   # Fetch the current user, and test for needed permissions
   currentUser = self.REQUEST.AUTHENTICATED_USER
   if currentUser.has_permission( 'Delete Objects', parentFolder ):
      # remove any of this group's member accounts (should destroy their shared resources, too)
      for aSubfolder in groupFolder.objectValues('Folder'):
         # delete each sub-folder
         self.deleteAccount( privateFolderPath=aSubfolder.absolute_url(relative=self.ResourceLibrary) )
            
      # delete the group folder
      targetID = groupFolder.getId()
      parentFolder.manage_delObjects( [targetID] )

      if self.REQUEST:  # we were probably called from HTML
         # redirect to a view of its parent group (updated member list)
         self.REQUEST.RESPONSE.redirect( parentFolder.absolute_url() )
      else:             # we were probably called from script, or XML-RPC
         return "<OK/>"
   else:
      return "ERROR: User '%s' is NOT authorized to delete this group!" % currentUser


##### Get lists of sibling names (userids, private folder names, group folder names,
##### or resource names) to prompt uesrs for unique input
def getListOfNames( nameType, parentContainer, skipName=None ):
   import string
   # 'nameType' should be 'user', 'private folder', 'group folder', 'resource'
   # 'parentContainer' should be whatever object holds the items we're listing
   # 'skipName' is optional; use to omit the name of an item whose name we're editing
   if nameType == 'user':
      # parentContainer should be a UserFolder, just get its names
      nameList = parentContainer.getUserNames()
   elif nameType == 'resource':
      # parentContainer should be a Folder, get its DTML Documents
      docList = parentContainer.objectValues( 'DTML Document' )
      # if a skip-name was specified, leave it out!
      # (NOTE: We're replacing all single quotes with escaped versions
      # for safe quoting in Javascript)
      nameList = [string.replace(aDoc.title, "\'", "\\\'") for aDoc in docList if (aDoc.title != skipName)]
   elif nameType == 'folder':  # private or group folder
      # parentContainer should be a Folder, get its DTML Documents
      folderList = parentContainer.objectValues( 'Folder' )
      # if a skip-name was specified, leave it out!
      nameList = [aFolder.title for aFolder in folderList] # if (aFolder.title != skipName)]
   else:
      return "ERROR: I don't know this nameType: '%s'" % (nameType)
   return nameList

##### Here are some internal (private) methods that support the API methods
##### above. NOTE that these require or return complex Zope objects, so
##### they won't respond well to XML-RPC requests!

def _getResourceObject( resourceID ):
   # Retrieve the resource (Zope object) with the specified ID, for closnoer inspection
   return 0

def _isAllowed( objResource, objUser ):
   # ?? Detailed confirmation (by whatever method) that the current user has permission
   # to read/write/share/revoke/delete the specified resource?
   #
   # Perhaps this is better done through inline permission checks, eg.
   # canWrite = AUTHENTICATED_USER.getBlah()
   return 0

def getPrivateFolderForUser( self, objUser, searchFolder=None ):
   import AccessControl.SpecialUsers
   # Crawl the PrivateData area for this user's private Folder, and return it (or None
   # if no matching Folder can be found). NOTE that this function is recursive; it
   # searches the children of the main 'PrivateData' folder (by default), or the
   # specified Folder object if we're digging through children..

   # Test 'objUser' to make sure it's User object (check for method)
   if not getattr(objUser, 'getUserName', None):    # it's not a User of any kind..
      return "ERROR: 'objUser' is not a User! (it's a '%s')" % (type(objUser))

   # Test 'searchFolder' to make sure it's an object, and a Folder
   if searchFolder is None:
      searchFolder = self.PrivateData

   # Test the ACL Users Folder, looking for the specified objUser;
   # if they're found, return searchFolder!
   isLocalManager = objUser.has_role( ['Manager'], object=searchFolder )
   if isLocalManager:
      return searchFolder
   
   userFolders = searchFolder.objectValues("User Folder")
   ##return "found %s user folders in '%s'" % (len(userFolders), searchFolder.getId())
   if len(userFolders) != 0:
      return "found a user folder in '%s'" % (searchFolder.getId())
      # Found a User Folder here! Let's take a look..
      localUserFolder = userFolders[0]
      # Search for the objUser; are they listed as a Manager here?
      targetName = objUser.getUserName()
      testUser = localUserFolder.getUser( targetName )
      if testUser != None:    # found 'em! this is their private folder..
         return searchFolder

   # Didn't find the User listed here? Then loop through this Folder's
   # children and recursively search any Folders found. If any of them
   # returns the user's private Folder, return it to my caller!
   for subFolder in searchFolder.objectValues("Folder"):
      foundFolder = getPrivateFolderForUser( self, objUser, searchFolder=subFolder )
      if foundFolder != None:    # We found it! return to my caller
         return foundFolder

   # Apparently it's not in here, return the bad news
   return None

   
def _getNextAvailableID( self ):
   # Read the next available ID from the ResourceLibrary object, then increment it;
   # return the found ID for use by the caller
   ###return self.id();
   libRoot = self.ResourceLibrary
   nextID = libRoot.nextAvailableID;
   libRoot.manage_changeProperties( REQUEST={'nextAvailableID':libRoot.nextAvailableID + 1} );
   return nextID;

def testID( self ):
   theID = _getNextAvailableID( self );
   return theID;


   
def getRawInput(self, REQUEST):
   # Return the complete content of REQUEST from FlashXML.sendAndLoad()
   meth = REQUEST.environ.get('REQUEST_METHOD','GET');
   # NOTE: Flash has a broken .sendAndLoad() method on Windows.. so we need to
   # force a "POST" response rather than handle "GET" differently.

   if meth != 'GET':  # leave this here in case Flash is fixed someday.
      # presumably the method is 'POST' (let's assume this for Flash)
      REQUEST.stdin.seek(0);
      rawResult = REQUEST.stdin.read();
   else:
      # presumably the method is 'GET'
      rawResult = REQUEST.environ.get('QUERY_STRING','');

   ###result = unicode(rawResult, 'application/x-www-form-urlencoded' );  #, 'x-www-form-urlencoded' );
   # TODO: Find the right encoding to do this?
   result = rawResult;
   return result;

def assertXMLRPCContentType( self, REQUEST ):
   # Attempt to reset the Content-Type of tihis 
   REQUEST.CONTENT_TYPE = 'text/xml';
   # REQUEST.environ.set('CONTENT_TYPE','text/xml');
   # REQUEST.set('CONTENT_TYPE','text/xml');
   # REQUEST.setHeader('Content-Type', 'text/xml');
   return;

def readFullRequest( self ):
   self.REQUEST.stdin.seek(0);
   rawInput = self.REQUEST.stdin.read();
   decodedInput = (rawInput);
   return 

def challengeUser( self ):
   # Try to provoke an authentication challenge on the current user
   # (should *always* work, we call it on any Anonymous User)
   ###self.AccessControl.SecurityManager.validate(None, None, None, None, None)
   return

def debug( ):
   # Activates the step-trace debugger; effectively, this should
   # give us the ability to invoke debugging from DTML, thus:
   # <dtml-call "debug">   <!--calls external method 'debug()'-->
   #
   # WARNING: This uses Python's 'pdb' debugging module, which means:
   #  - we have to be looking at the console running Zope to use it!
   #  - it will STOP Zope (like under hypnosis) until you're done!
   import pdb
   pdb.set_trace( )
   return


def moveResource( self, resourcePath, toContainerPath, redirectURL=None ):
   # Attempt to move the specified resource, e.g. from this user's 
   # private folder to the shared-data folder. Do NOT change
   # ownership of the resource, just its location!

   # Expecting 2 (maybe 3) arguments. NOTE that all the 'path' arguments
   # are assumed to be relative URLs within this ResourceLibrary!
   #  'resourcePath'
   #  'toContainerPath'
   #  'redirectURL' [optional *absolute* URL to which we'll bounce when finished]

   targetResource = self.ResourceLibrary.unrestrictedTraverse( resourcePath, default=None )
   if targetResource is None:
      return "ERROR: Invalid target resource path!"
   fromContainer = targetResource.aq_parent
   toContainer = self.ResourceLibrary.unrestrictedTraverse( toContainerPath, default=None )
   if targetResource is None:
      return "ERROR: Invalid to-container path!"

   # Make sure the user has permissions
   currentUser = self.REQUEST.AUTHENTICATED_USER
   if currentUser.has_permission( 'Delete objects', fromContainer ):
      if currentUser.has_permission( 'Add Documents, Images, and Files', toContainer ):
         # OK, looks like this operation is legit.. Let's move it!
         targetID = targetResource.getId()
         clipboardData = fromContainer.manage_cutObjects( ids=[targetID] )
         toContainer.manage_pasteObjects( clipboardData )
      else:
            return "ERROR: User not authorized to add to '%s'!" % (toContainer.getId())
   else:
      return "ERROR: User not authorized to delete from '%s'!" % (fromContainer.getId() )

   if redirectURL is None:
      # presumably called from XML-RPC
      return "<OK>It's moved!</OK>"
   else:
      # called from HTML, bounce to the requested URL (eg. user's private area)
      self.REQUEST.RESPONSE.redirect( redirectURL )

def cloneResource( self, resourcePath, newName ):
   # Make a copy of an existing library resource, and save it with the
   # new name in this user's private folder. NOTE that we'll also need
   # a fresh, serialized unique ID--in fact, only the description and data
   # from the resource will be copied.
   #
   # If this request came from an HTML page, redirect to the user's private
   # folder (where the new clone will be waiting). If it's from XML or
   # called by script, just send a simple XML response (new resource path)

   targetResource = self.ResourceLibrary.unrestrictedTraverse( resourcePath, default=None )
   if targetResource is None:
      return "ERROR: Invalid target resource path!"
   
   # find this user's private folder
   currentUser = self.REQUEST.AUTHENTICATED_USER
   privateFolder = getPrivateFolderForUser( self, currentUser )
   if not privateFolder:
      return "ERROR: Unable to locate private folder for user '%s'" % currentUser

   # make a new resource in the private folder, and transfer data from the old
   result = addOrUpdateResource( self,
      folderPath = privateFolder.absolute_url(relative = self.ResourceLibrary),
      ID = '',
      name = newName,
      description = getattr( targetResource, 'description', '' ),
      resourceData = targetResource.document_src(),
      type = getattr( targetResource, 'resourceType', 'generic' )
   )
   # look in resulting Resource object for a known attribute
   if getattr(result, 'ID', None):
      return "ERROR: Unable to add new resource!"
   else:
      newPath = "%s/%s" % (result['folderPath'], result['ID'])

   theClone = self.ResourceLibrary.unrestrictedTraverse( newPath )

   if self.REQUEST:  # we were probably called from HTML
      # redirect to a view of its parent group (updated member list)
      self.REQUEST.RESPONSE.redirect( privateFolder.absolute_url() )
   else:
      # presumably called from XML-RPC
      return "<OK>%s</OK>" % ( theClone.absolute_url(relative = self.ResourceLibrary) )
   
def getCurrentUser( self, authInfo=None, ignoreMe=None, meToo=None ):
   import AccessControl.SpecialUsers
   # Based on expected 'authInfo' { 'name':'joe', 'password':'123' },
   # verify and return a matching User object, if any.

   # IF authInfo is None, or the name or password don't check out, then
   # either the auth-info is bad, or this user is truly anonymous, or 
   # we're in a call-chain from HTML pages.

   if authInfo:      # TODO: Determine that it's a dictionary?
      # Carefully look for supplied info
      #testName = getattr( authInfo, 'name', None )
      testName = authInfo.get('name', None)
      testPassword = authInfo.get('password', None)
   
      if testName and testPassword:    # values found in both
         # test the supplied name and password against our app's user folder
         bigUserFolder = self.ResourceLibrary.aq_parent.acl_users
         if not bigUserFolder:
            return "ERROR: No main User Folder found for app '%s'!" % (libRoot.aq_parent.getId())

         testUser = bigUserFolder.getUser( testName )  # returns None if not found
         if testUser:
            # check their password against the one supplied
            if testUser.authenticate( testPassword, request=None ):
               return testUser

   # Still here? Then look for the authenticated user in REQUEST and
   # return it (since we may have been called from an HTML situation,
   # with proper authentication). If there is no request, return the
   # Anonymous User
   if self.REQUEST:			# WAS: if self.REQUEST.AUTHENTICATED_USER:
      return self.REQUEST.AUTHENTICATED_USER
   else:
      # Return the Anonymous User (defined in 'User.py')
      return AccessControl.SpecialUsers.nobody

     
def whoAmI( self, authInfo=None, ignoreMe=None, meToo=None ):
   # A support method that returns just the userid to an XML-RPC caller;
   # this allows us to authenticate the name+password in authInfo. If
   # there's no matching user, returns 'Anonymous User'
   theUser = getCurrentUser( self, authInfo )
   return theUser.getUserName()


def ping( self, authInfo=None ):
   # Slightly enhanced form of whoAmI(), also returns an unambiguous
   # status message
   theUser = getCurrentUser( self, authInfo )
   return "OK:%s" % ( theUser.getUserName() )

def escapeForXML(s):
    """Replace special characters '&', "'", '<', '>' and '"' by XML entities."""
    s = s.replace("&", "&amp;") # Must be done first!
    s = s.replace("'", "&apos;")
    s = s.replace("<", "&lt;")
    s = s.replace(">", "&gt;")
    s = s.replace('"', "&quot;")
    return s

# TODO:
#  - Use proper XMLDOM manipulation script to build XML trees, rather
#     than string manipulation
#
# Remember that we can call other external ResourceLibrary methods thus: 
#      msg=self.sayHello()
#
# We can also get a pointer to my parent container in Zope
#   myParentContainer = self.aq_parent
#   return myParentContainer.getId()
  
