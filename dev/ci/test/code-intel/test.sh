#!/usr/bin/env bash

# This script runs the codeintel-qa test utility against a candidate server image.

cd "$(dirname "${BASH_SOURCE[0]}")/../../../.."
SG_ROOT=$(pwd)
set -ex

IMAGE="us.gcr.io/sourcegraph-dev/server:$CANDIDATE_VERSION"
yes | gcloud auth configure-docker

# ==========================

URL="http://localhost:7080"
export SOURCEGRAPH_BASE_URL="${URL}"

if curl --output /dev/null --silent --head --fail $URL; then
  echo "❌ Can't run a new Sourcegraph instance on $URL because another instance is already running."
  echo "❌ The last time this happened, there was a runaway integration test run on the same Buildkite agent and the fix was to delete the pod and rebuild."
  exit 1
fi

echo "--- Running a daemonized $IMAGE as the test subject..."
CONTAINER="$(docker container run -d -e GOTRACEBACK=all "$IMAGE")"
function cleanup() {
  exit_status=$?
  if [ $exit_status -ne 0 ]; then
    # Expand the output if our run failed.
    echo "^^^ +++"
  fi

  jobs -p -r | xargs kill
  echo "--- server logs"
  docker logs --timestamps "$CONTAINER"
  echo "--- docker cleanup"
  docker container rm -f "$CONTAINER"
  docker image rm -f "$IMAGE"

  if [ $exit_status -ne 0 ]; then
    # This command will fail, so our last step will be expanded. We don't want
    # to expand "docker cleanup" so we add in a dummy section.
    echo "--- gqltest failed"
    echo "See go test section for test runner logs."
  fi
}
trap cleanup EXIT

docker exec "$CONTAINER" apk add --no-cache socat
# Connect the server container's port 7080 to localhost:7080 so that integration tests
# can hit it. This is similar to port-forwarding via SSH tunneling, but uses `docker exec`
# as the transport.
socat tcp-listen:7080,reuseaddr,fork system:"docker exec -i $CONTAINER socat stdio 'tcp:localhost:7080'" &

echo "--- Waiting for $URL to be up"
set +e
timeout 120s bash -c "until curl --output /dev/null --silent --head --fail $URL; do
    echo Waiting 5s for $URL...
    sleep 5
done"
# shellcheck disable=SC2181
if [ $? -ne 0 ]; then
  echo "^^^ +++"
  echo "$URL was not accessible within 120s. Here's the output of docker inspect and docker logs:"
  docker inspect "$CONTAINER"
  exit 1
fi
set -e
echo "Waiting for $URL... done"

# ==========================

pushd internal/cmd/init-sg
go build -o "${SG_ROOT}/init-sg"
popd

pushd dev/ci/test/code-intel
"${SG_ROOT}/init-sg" initSG
# Disable `-x` to avoid printing secrets
set +x
source /root/.profile
export GITHUB_TOKEN="${GITHUB_USER_BOB_TOKEN}"
set -x
"${SG_ROOT}/init-sg" addRepos -config repos.json
popd

# ==========================

echo "TEST: Running tests"
pushd dev/codeintel-qa
./scripts/download.sh
go build ./cmd/upload
go build ./cmd/query
./upload --verbose --timeout=5m
./query
popd
