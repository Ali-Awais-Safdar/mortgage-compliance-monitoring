export type BoundingBoxParseError = {
  _tag: "BoundingBoxParseError";
  message: string;
};

export type AddressError = {
  _tag: "AddressError";
  message: string;
};

export type DomainError = BoundingBoxParseError | AddressError;

