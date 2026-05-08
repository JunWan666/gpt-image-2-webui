#!/bin/sh
set -eu

to_lower() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

is_truthy() {
    case "$(to_lower "${1:-}")" in
        1 | true | yes | on)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

is_positive_integer() {
    case "${1:-}" in
        '' | *[!0-9]*)
            return 1
            ;;
        0)
            return 1
            ;;
        *)
            return 0
            ;;
    esac
}

cleanup_enabled="${GENERATED_IMAGE_CLEANUP_ENABLED:-true}"
cleanup_run_on_start="${GENERATED_IMAGE_CLEANUP_RUN_ON_START:-true}"
cleanup_dry_run="${GENERATED_IMAGE_CLEANUP_DRY_RUN:-false}"
cleanup_image_dir="${GENERATED_IMAGE_DIR:-${IMAGE_DIR:-/app/generated-images}}"
cleanup_retention_days="${GENERATED_IMAGE_RETENTION_DAYS:-${RETENTION_DAYS:-3}}"
cleanup_interval_hours="${GENERATED_IMAGE_CLEANUP_INTERVAL_HOURS:-24}"
cleanup_log_file="${GENERATED_IMAGE_CLEANUP_LOG_FILE:-${LOG_FILE:-/app/logs/cleanup-generated-images.log}}"
cleanup_lock_file="${GENERATED_IMAGE_CLEANUP_LOCK_FILE:-${LOCK_FILE:-/tmp/gpt-image-2-webui-cleanup-generated-images.lock}}"

if ! is_positive_integer "$cleanup_interval_hours"; then
    echo "Invalid GENERATED_IMAGE_CLEANUP_INTERVAL_HOURS=$cleanup_interval_hours, using 24."
    cleanup_interval_hours=24
fi

cleanup_interval_seconds=$((cleanup_interval_hours * 60 * 60))
cleanup_pid=''
app_pid=''

run_generated_image_cleanup() {
    dry_run_arg=''
    if is_truthy "$cleanup_dry_run"; then
        dry_run_arg='--dry-run'
    fi

    echo "Running generated image cleanup: image_dir=$cleanup_image_dir retention_days=$cleanup_retention_days dry_run=$cleanup_dry_run"

    if ! /app/scripts/cleanup-generated-images.sh \
        --run \
        --image-dir "$cleanup_image_dir" \
        --retention-days "$cleanup_retention_days" \
        --log-file "$cleanup_log_file" \
        --lock-file "$cleanup_lock_file" \
        $dry_run_arg; then
        echo "Generated image cleanup failed. Check $cleanup_log_file for details."
    fi
}

cleanup_loop() {
    if is_truthy "$cleanup_run_on_start"; then
        run_generated_image_cleanup
    fi

    while :; do
        sleep "$cleanup_interval_seconds"
        run_generated_image_cleanup
    done
}

stop_processes() {
    if [ -n "$cleanup_pid" ]; then
        kill "$cleanup_pid" 2>/dev/null || true
    fi

    if [ -n "$app_pid" ]; then
        kill "$app_pid" 2>/dev/null || true
    fi
}

if is_truthy "$cleanup_enabled"; then
    echo "Generated image cleanup is enabled. Interval=${cleanup_interval_hours}h, retention_days=$cleanup_retention_days."
    cleanup_loop &
    cleanup_pid=$!
else
    echo "Generated image cleanup is disabled."
fi

trap stop_processes INT TERM

"$@" &
app_pid=$!

set +e
wait "$app_pid"
status=$?
set -e

stop_processes
if [ -n "$cleanup_pid" ]; then
    wait "$cleanup_pid" 2>/dev/null || true
fi

exit "$status"
