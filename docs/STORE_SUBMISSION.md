# Microsoft Store Preparation

Lirune Reader keeps the direct Windows NSIS installer separate from the Store package target. The installed electron-builder version exposes this target as `appx`; Microsoft Store tooling may produce or accept APPX/MSIX packages depending on the submission workflow.

## Local command

```powershell
 $env:APPX_PUBLISHER = 'CN=the-exact-partner-center-publisher-identity'
npm run dist:store
```

The Store build requires account-specific configuration that is intentionally not committed: Partner Center package identity, publisher identity, signing, logos/tiles, and any required Store manifest values. Do not invent a publisher ID or certificate. The current repository does not yet claim a completed Store package until those values are configured and the package is validated.

Before submission:

- configure the identity to match Partner Center
- build the x64 MSIX
- inspect version, executable, display name, icon, and EPUB association
- run Windows App Certification Kit validation
- test clean install, upgrade, launch, association, and uninstall
- provide privacy and support URLs
- upload screenshots and listing metadata

Microsoft Store certification and Partner Center submission have not been performed by this repository automation.
