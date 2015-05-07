#!/bin/bash

set -e

USERNAME=daneel
API_URL=https://stagingstack.versal.com/api2
SITE_URL=https://staging.versal.com

VALIDATOR_USER_IDS=(
  # carlos
  38251
  # mike
  38321
  # devon
  396761
  # stephen
  39588577
  291396513
  # monz
  45760063
  # mike c
  45760063
  # dan r
  351780264
)

which json >> /dev/null || npm install --global json
which versal >> /dev/null || npm install --global versal-sdk

CURRENT_COMMIT=${TRAVIS_COMMIT}
REPO=${TRAVIS_REPO_SLUG}

# Notify via github statuses API
function update_status {
  STATE=$1
  CONTEXT=$2
  DESCRIPTION=$3
  TARGET_URL=$4

  curl \
    -X POST https://api.github.com/repos/${REPO}/statuses/${CURRENT_COMMIT}?access_token=${GITHUB_API_TOKEN} \
    --data '{"state": "'"${STATE}"'", "target_url": "'"${TARGET_URL}"'", "description": "'"${DESCRIPTION}"'", "context": "'"${CONTEXT}"'"}'
}

# After a command has run update the status based on exit code
function update_status_based_on_exit_code {
  CONTEXT=$1
  DESCRIPTION=$2
  TARGET_URL=$3

  if [ $? -eq 0 ]
  then
    update_status success "$CONTEXT" "$DESCRIPTION" "$TARGET_URL"
  else
    update_status failure "$CONTEXT" "$DESCRIPTION" "$TARGET_URL"
  fi
}

# Notify pending for all tasks
update_status pending build-gadget 'Build gadget'
update_status pending upload-gadget 'Upload gadget'
update_status pending demo-course 'Demo course'

# Build the gadget
make bundle-prod
update_status_based_on_exit_code build-gadget 'Build gadget'

# collect variables (important that this happens after bundling for some gadgets
NAME=$(cat versal.json | json name)
TITLE=$(cat versal.json | json title)
VERSION=$(cat versal.json | json version)

SLUG="${NAME}-${TRAVIS_BUILD_NUMBER}"
BUILD_NAME="${TITLE} (build ${TRAVIS_BUILD_NUMBER})"
GADGET_TYPE=${USERNAME}/${SLUG}
MANIFEST_URL=${API_URL}/gadgets/${USERNAME}/$SLUG/$VERSION/versal.json

DEMO_URL=${SITE_URL}/c/${SLUG}/edit

# Mangle the config so that we don't have to deal with version bumping
json -I -f versal.json -e "this.name='${SLUG}'"
json -I -f versal.json -e "this.title='${BUILD_NAME}'"

# Upload gadget to platform
versal upload \
  --apiUrl ${API_URL} \
  --sessionId ${SESSION_ID}

update_status_based_on_exit_code upload-gadget 'Upload gadget'

# Create a demo course
curl \
  -X PUT $API_URL/courses/${SLUG} \
  -HSID:${SESSION_ID} \
  --data '{"title": "'"${BUILD_NAME}"'", "lessons": [{ "id": "l1", "title": "Demo", "gadgets": []}]}'

# Add the gadget to the demo course
curl \
  -X POST $API_URL/courses/${SLUG}/lessons/l1/gadgets \
  -HSID:${SESSION_ID} \
  --data '{"index": 1, "config": {}, "userState": {}, "type": "'"${GADGET_TYPE}"'", "manifestUrl": "'"${MANIFEST_URL}"'"}'

update_status_based_on_exit_code demo-course 'Demo course' $DEMO_URL

# Add cool people to the course
for USER_ID in "${VALIDATOR_USER_IDS[@]}"
do
  curl -X PUT ${API_URL}/courses/${SLUG}/users/${USER_ID} --data '{"roles": ["author"]}' -HSID:$SESSION_ID
done
