import { Result } from "@carbonteq/fp";
import type { AddressResolverPort, ResolvedSearchFlags } from "@poc/core";
import type { AppError } from "@poc/core";
import { parseBoundingBox } from "@poc/core";

export class StaticAddressResolverAdapter implements AddressResolverPort {
  private readonly addressMap: Map<string, ResolvedSearchFlags>;

  constructor() {
    this.addressMap = new Map<string, ResolvedSearchFlags>();

    const whiteHavenBbox = parseBoundingBox("41.014581780039535,-75.81544190595048,41.01436674658937,-75.81554452140006").unwrap();
    const whiteHavenFlags: ResolvedSearchFlags = {
      bbox: whiteHavenBbox,
      zoomLevel: 17,
      queryAddress: "12 Polonia Ct, White Haven, PA 18661, United States",
      refinementPath: "/homes",
      searchByMap: true,
    };
    this.addAddress("12 Polonia Ct, White Haven, PA 18661, USA", whiteHavenFlags);
    this.addAddress("12 Polonia Ct, White Haven, PA 18661, United States", whiteHavenFlags);

    const fennvilleBbox = parseBoundingBox("42.54826130737213,-86.23770074855929,42.54790113452498,-86.23793458777914").unwrap();
    const fennvilleFlags: ResolvedSearchFlags = {
      bbox: fennvilleBbox,
      zoomLevel: 17,
      queryAddress: "1786 Morning Glory Lane, Fennville, Michigan, United States",
      refinementPath: "/homes",
      searchByMap: true,
    };
    this.addAddress("1786 Morning Glory Lane, Fennville, Michigan, USA", fennvilleFlags);
    this.addAddress("1786 Morning Glory Lane, Fennville, Michigan, United States", fennvilleFlags);

    const sanPedroBbox = parseBoundingBox("33.73686973911878,-118.30032618062285,33.734924025747034,-118.30147430987995").unwrap();
    const sanPedroFlags: ResolvedSearchFlags = {
      bbox: sanPedroBbox,
      zoomLevel: 17,
      queryAddress: "918 South Leland Street unit 2, San Pedro, CA 90731, USA",
      refinementPath: "/homes",
      searchByMap: true,
    };
    this.addAddress("918 S Leland St Unit 2, San Pedro, CA 90731, USA", sanPedroFlags);
    this.addAddress("918 South Leland Street unit 2, San Pedro, CA 90731, USA", sanPedroFlags);

    const moreheadCityBbox = parseBoundingBox("34.722407160598,-76.71516935375814,34.72217981453618,-76.71526663098314").unwrap();
    const moreheadCityFlags: ResolvedSearchFlags = {
      bbox: moreheadCityBbox,
      zoomLevel: 17,
      queryAddress: "913 Bridges Street Ext, Morehead City, NC 28557, United States",
      refinementPath: "/homes",
      searchByMap: true,
    };
    this.addAddress("913 Bridges St, Morehead City, NC 28557, USA", moreheadCityFlags);
    this.addAddress("913 Bridges Street Ext, Morehead City, NC 28557, United States", moreheadCityFlags);
  }

  private addAddress(address: string, flags: ResolvedSearchFlags): void {
    const normalized = this.normalizeAddress(address);
    this.addressMap.set(normalized, flags);
  }

  private normalizeAddress(address: string): string {
    return address.trim().toLowerCase();
  }

  resolve(address: string): Result<ResolvedSearchFlags, AppError> {
    const normalized = this.normalizeAddress(address);
    const flags = this.addressMap.get(normalized);

    if (!flags) {
      return Result.Err({
        kind: "InvalidInputError",
        message: "Unknown address",
      } as AppError);
    }
    return Result.Ok(flags);
  }
}

