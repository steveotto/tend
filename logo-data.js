/* Tend brand logo - supplied tend-logo.png, downscaled for header use (same approved shape) */
(function(){
  var d="data:image/png;base64,[LOGO]";
  function set(){
    var imgs=document.querySelectorAll('img[data-tend-logo]');
    for(var i=0;i<imgs.length;i++){ imgs[i].src=d; }
  }
  if(document.readyState==="loading"){ document.addEventListener("DOMContentLoaded",set); } else { set(); }
})();
