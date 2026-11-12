document.querySelectorAll(".qform").forEach(function(f){
 f.addEventListener("submit",function(e){
  e.preventDefault();
  var d=new FormData(f), lines=[];
  d.forEach(function(v,k){ if(v) lines.push(k.charAt(0).toUpperCase()+k.slice(1)+": "+v); });
  var subject="Camera trailer quote request - "+f.dataset.city;
  window.location.href="mailto:"+f.dataset.email+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(lines.join("\n"));
  f.querySelector(".formnote").textContent="Your email app should open with the request filled in. If it doesn't, call us instead.";
 });
});
