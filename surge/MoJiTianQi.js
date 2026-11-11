// 墨迹天气 VIP 解锁 · 手搓版
// 适用：Surge / Quantumult X / Loon（http-response 脚本）
// 改自 7452323/QuantumultX 的 Mojitianqi.js，主要修复：
//  1. 原 QX 版正则 [^\/]+ 匹配不到裸域名 api.moji.com，改成可空的子域名段
//  2. 兼容返回体包在 data 里和直接平铺两种结构，两层同时打补丁
//  3. is_adver_free 修正为 1；补了 user_member_info.expire_time 等字段
//  4. 全程 try/catch，解析失败原样放行，不会把天气请求搞坏
//
// Surge 模块：
//   [Script]
//   墨迹天气 = type=http-response,pattern=^https?:\/\/([a-z0-9-]+\.)*api\.moji\.com\/(sns\/json\/profile\/get_info.*|json\/member_new\/homepage_info.*|user\/personal\/json\/profile.*|flycard\/novice|shortvideo\/.*),requires-body=true,max-size=-1,script-path=https://cdn.jsdelivr.net/gh/neeilwu/feishu-daily-sync@main/surge/MoJiTianQi.js,timeout=60
//   [MITM]
//   hostname = %APPEND% api.moji.com, *.api.moji.com
//
// 调试：DEBUG=true 时，命中会员接口会弹一条通知，证明脚本跑起来了。
// 确认能用后，把下面改成 false 就不弹了。

const DEBUG = true;
const EXPIRE = 4092599349000; // 2099-09-09
const EXPIRE_STR = "2099-09-09到期";

function isObj(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// 对目标对象和它里面的 data 层同时打补丁，两种结构都覆盖
function patchBoth(obj, fn) {
  fn(obj);
  if (isObj(obj.data)) fn(obj.data);
}

function patchGetInfo(o) {
  if (!isObj(o)) return;
  o.is_vip = 1;
  o.type = 7;
  o.grade = 1;
  o.is_adver_free = 1;
  o.expire_time = EXPIRE;
  o.member_type = 1;
  o.member_level = 1;
  o.max_expiration_days = 9999999;
  o.is_expire = 0;
  o.remain_day = 9999999;
  o.inkrity = 9999999;
  o.status = 1;
  o.is_purchase = true;
}

function patchHomepage(o) {
  if (!isObj(o)) return;
  o.userTips = [EXPIRE_STR];
  o.user_tips = [EXPIRE_STR];
  o.is_member = true;
  if (isObj(o.user_member_info)) {
    o.user_member_info.vip = 1;
    o.user_member_info.is_auto_member = 1;
    o.user_member_info.expire_time = EXPIRE;
  }
}

function patchProfile(o) {
  if (!isObj(o)) return;
  const p = o.personal_profile;
  if (isObj(p)) {
    p.inkrity = 9999999;
    p.is_vip = true;
    p.grade = 1;
    p.user_flag = true;
    p.vip_expire_time = EXPIRE;
  }
}

function patchFlycard(o) {
  if (!isObj(o)) return;
  const n = isObj(o.data) ? o.data.novice : null;
  if (isObj(n)) {
    n.adShow = 0;
    n.expireTime = EXPIRE;
    n.vipShow = 1;
  }
}

function patchShortvideo(o) {
  if (!isObj(o)) return;
  o.item_list = [];
  o.rcmList = [];
  o.add_card_list = [];
  o.feeds = [];
}

try {
  const url = $request.url;
  const obj = JSON.parse($response.body);
  let out = obj;
  let hit = "";

  if (url.indexOf("/sns/json/profile/get_info") !== -1) {
    patchBoth(obj, patchGetInfo);
    hit = "get_info";
  } else if (url.indexOf("/json/member_new/homepage_info") !== -1) {
    patchBoth(obj, patchHomepage);
    hit = "homepage_info";
  } else if (url.indexOf("/user/personal/json/profile") !== -1) {
    patchBoth(obj, patchProfile);
    hit = "profile";
  } else if (url.indexOf("/flycard/novice") !== -1) {
    patchFlycard(obj);
    hit = "flycard";
  } else if (url.indexOf("/shortvideo") !== -1) {
    if (Array.isArray(obj)) {
      out = [];
    } else {
      patchBoth(obj, patchShortvideo);
    }
    hit = "shortvideo";
  }

  if (hit) {
    console.log("[MoJi] patched: " + hit);
    if (DEBUG && hit !== "shortvideo" && typeof $notification !== "undefined") {
      $notification.post("墨迹天气脚本已触发", hit, "会员接口已改写，去看下会员页");
    }
  }
  $done({ body: JSON.stringify(out) });
} catch (e) {
  console.log("[MoJi] error: " + e);
  $done({});
}
