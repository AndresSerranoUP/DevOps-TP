export enum IsDisabled {
  Active = 0,
  Disabled = 1,
}

export enum RatingLikeDislike {
  Dislike = 0,
  Like = 1,
  Neutral = 2,
}

export enum RangoDeveloper {
  Owner = 0,
  Admin = 1,
  Member = 2,
}

export const MEDIA_TYPES = {
  Featured: 2,
  Screenshot: 5,
} as const;

export enum MediaTypeEnum {
  Featured = 2,
  Screenshot = 5,
}
