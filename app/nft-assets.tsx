'use client';
import { useState } from 'react';
import { Image as ImageIcon, Wallet, Check, ShieldCheck } from 'lucide-react';
import type { Asset, Portfolio } from '../lib/portfolio';
import { assetKey } from '../lib/portfolio';
import { useLocale } from './locale';

export function AssetImage({asset,className='asset-picture'}:{asset:Asset;className?:string}){
 const [failed,setFailed]=useState(false);
 return <span className={className}>{asset.image&&asset.id&&!failed?
  // eslint-disable-next-line @next/next/no-img-element -- Authenticated same-origin media proxy.
  <img src={`/api/asset-image?id=${encodeURIComponent(asset.id)}`} alt={asset.name} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:asset.kind==='nft'?<ImageIcon size={24}/>:<span>{asset.symbol.slice(0,2)}</span>}</span>;
}
export function BrandMark({brand,assets}:{brand:Portfolio['brand'];assets:Asset[]}){
 const asset=brand&&assets.find(a=>a.id===brand.id);
 return asset?<AssetImage key={asset.id} asset={asset} className="brand-picture"/>:<span className="brand-picture placeholder"><Wallet size={25}/></span>;
}
export function NftGallery({assets,hidden,onInspect,onBrand}:{assets:Asset[];hidden:boolean;onInspect:(id:string)=>void;onBrand:(id:string)=>void}){
 const {t}=useLocale();
 return <div className="nft-gallery">{assets.map(asset=><article className="nft-card" key={assetKey(asset)}><button className="nft-inspect" onClick={()=>onInspect(assetKey(asset))}><AssetImage asset={asset} className="nft-art"/><div className="nft-card-info"><span>{asset.collection??'NFT'}</span><strong>{asset.name}</strong><span className="nft-card-value">{hidden?'••••':new Intl.NumberFormat('en-US',{maximumFractionDigits:2,minimumFractionDigits:2}).format(asset.value??0)} <small>USDT</small></span><span>{t('컬렉션 최저가 기준')} · {hidden?'••':asset.amount} {t('개')}</span></div></button><button className="text-button nft-use" onClick={()=>onBrand(assetKey(asset))} disabled={!asset.image}>{t('대표 이미지로 선택')}</button></article>)}</div>;
}
export function BrandPicker({data,saving,onSelect}:{data:Portfolio;saving:boolean;onSelect:(id:string|null)=>void}){
 const {t}=useLocale(),nfts=data.assets.filter(a=>a.kind==='nft');
 return <div className="brand-picker"><p>{t('보유 NFT를 상단 이미지로 선택하세요. 가격에 관계없이 선택할 수 있습니다.')}</p>{nfts.length?<div className="brand-options">{nfts.map(asset=><button key={assetKey(asset)} disabled={saving||!asset.image} aria-pressed={data.brand?.id===asset.id} onClick={()=>onSelect(assetKey(asset))}><AssetImage asset={asset} className="brand-option-art"/><span><strong>{asset.name}</strong><small>{asset.collection??'NFT'}</small></span>{data.brand?.id===asset.id&&<Check size={18}/>}</button>)}</div>:<div className="empty-state"><ImageIcon size={28}/><strong>{t('조회된 NFT가 없습니다.')}</strong><span>{t('이더리움 지갑을 연결한 뒤 새로고침해 주세요.')}</span></div>}<button className="button secondary full-width" disabled={saving} onClick={()=>onSelect(null)}>{t('기본 이미지 사용')}</button></div>;
}
export function NftKeyForm({saving,error,onSubmit}:{saving:boolean;error:string;onSubmit:(event:React.FormEvent<HTMLFormElement>)=>void}){
 const {t}=useLocale();
 return <section className="nft-api-settings"><div className="section-heading"><div><span className="section-kicker">OpenSea</span><h2>{t('NFT 평가액 연결')}</h2></div><ShieldCheck size={22}/></div><p>{t('자동 조회가 제한되면 OpenSea API 키를 저장하세요. 키는 서버에 암호화 보관합니다.')}</p><form onSubmit={onSubmit}><label className="form-field">OpenSea API Key<input name="openSeaKey" type="password" autoComplete="new-password" required maxLength={512} placeholder={t('조회용 API 키')}/></label>{error&&<p className="form-error">{t(error)}</p>}<button type="submit" className="button secondary" disabled={saving}>{saving?t('저장 중…'):t('키 저장')}</button><a href="https://opensea.io/settings/developer" target="_blank" rel="noreferrer">{t('OpenSea API 키 발급')}</a></form></section>;
}
