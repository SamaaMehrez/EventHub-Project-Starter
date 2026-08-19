
````markdown
# Podman on Windows/WSL2: Networking Issues and Fixes

My environment uses:

- **Podman 6.0.2**
- **Windows 11**
- **WSL2 backend**
I encountered several related networking problems, all stemming from the same root cause.

## Root Cause

Podman's default network backend, **Netavark**, uses `nftables` for firewall and NAT rules.

However, the **WSL2 kernel does not support `nftables`**.

This caused several networking-related issues when running and building containers.

---

## Issue 1: Containers Could Not Start

Running:

```bash
podman run
````

failed immediately with:

```text
netavark (exit code 1): nftables error: "nft" did not return successfully
```

### Fix

I set:

```toml
firewall_driver="none"
```

in the same Podman configuration file.

This disables Netavark's automatic firewall/NAT rule management.

---

## Issue 2: Containers Could Not Reach the Internet During Build

After setting:

```toml
firewall_driver="none"
```

containers could start, but `podman build` could no longer access the internet.

For example, the build failed when trying to download Maven dependencies with:

```text
Network is unreachable
```

### Fix

I built the images using the host's network:

```bash
podman build --network=host
```

This allows the build container to share the host's network stack directly.

---

## Issue 3: Published Ports Did Not Work

Containers were running successfully and could be reached using their internal IP addresses.

However, published ports such as:

```bash
-p 8081:8081
```

did not work, even from inside the VM.

### Fix

I switched the Podman machine to **rootless mode**:

```bash
podman machine set --rootful=false
```

Rootless mode handles port publishing through a separate userspace mechanism called **Pasta**.

Pasta does not depend on Netavark's firewall rules, so published ports started working correctly.

---

# Health Checks

## Problem

I initially added a `HEALTHCHECK` instruction to each `Containerfile`, following standard Docker practice.

After building and running the containers, however:

```bash
podman ps
```

never showed a:

```text
(healthy)
```

status.

Also:

```bash
podman inspect <container> --format '{{.State.Health.Status}}'
```

returned a nil pointer error.

This meant that **Podman was not tracking any health check state for these containers**.

---

## Root Cause

`podman build` defaults to building images in **OCI format**, rather than Docker format.

The OCI image specification does not have a `Healthcheck` field.

The `Healthcheck` field is a **Docker-specific extension** to Docker's image format.

Therefore, the `HEALTHCHECK` instruction in the `Containerfile` was silently ignored when the image was built in the default OCI format.

I confirmed this by running:

```bash
podman inspect <image> --format '{{.Config.Healthcheck}}'
```

which returned:

```text
can't evaluate field Healthcheck in type *v1.ImageConfig
```

This confirmed that the field genuinely does not exist in the OCI image configuration.

---

## Considered Alternative

I considered rebuilding the images using Docker's image format:

```bash
podman build --format docker
```

This would allow the Docker-specific `Healthcheck` metadata to be stored in the image.

However, I chose **not** to do this because:

---

## Fix: Define Health Checks at Runtime

Instead of defining the health check in the `Containerfile`, I define it when starting the container using Podman's runtime health-check options:

```text
--health-cmd
--health-interval
--health-timeout
--health-start-period
--health-retries
```

This allows Podman to actively poll the container and track its health status.

After applying this approach, the **catalog** and **auth** services correctly showed:

```text
(healthy)
```

in:

```bash
podman ps
```

Podman can also report:

```text
(unhealthy)
```

if the health check fails.

---

## PowerShell Quoting Issue

One practical issue I encountered was passing a `--health-cmd` containing nested quotes.

For example, a Python one-liner may contain both single and double quotes.

Passing such a command through PowerShell can be fragile because PowerShell's own quoting and escaping rules interact with the quoted command being passed to Podman.

### Recommended Solution

For any health check that requires a multi-argument or quote-heavy command, use a small standalone script instead.

For example:

```text
healthcheck.sh
```

Copy the script into the image:

```dockerfile
COPY healthcheck.sh /healthcheck.sh
```

Then point `--health-cmd` at the script:

```bash
--health-cmd="/healthcheck.sh"
```

This avoids complex inline quoting on the command line and makes the health check more reliable.

---

# Final Takeaways

### Networking

| Problem                              | Cause                                                        | Fix                                                               |
| ------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Containers could not start           | Netavark required unsupported `nftables`                     | `firewall_driver="none"`                                          |
| Builds could not access the internet | Disabling firewall management affected networking            | `podman build --network=host`                                     |
| Published ports did not work         | Port publishing depended on the problematic networking setup | Switch to rootless mode with `podman machine set --rootful=false` |

### Health Checks

| Problem                                       | Cause                                                  | Fix                                       |
| --------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- |
| `HEALTHCHECK` in `Containerfile` did not work | OCI images do not contain Docker's `Healthcheck` field | Define health checks at `podman run` time |
| Complex `--health-cmd` failed in PowerShell   | Nested quoting and escaping                            | Use a standalone health-check script      |

```
```
